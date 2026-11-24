import { NextResponse } from "next/server";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import * as db from "@/lib/db/client";
import { SQL_NOW, abortCode, guard } from "@/lib/db/sqlite-dialect";
import { getEffectiveEventLimits, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";
import { enqueueWebhookEvent } from "@/lib/webhooks";
import { checkInSchema, walkInSchema, listCheckInGuests, updateCheckInGuestStatement, type CheckInGuest } from '@/lib/check-in-store';

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "check_in_guests")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guests = await listCheckInGuests(db, eventId);
  return NextResponse.json(guests, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(request: Request, { params }: Params) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "check_in_guests")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = checkInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid check-in request" }, { status: 400 });

  const owner = await db.queryOne<{ user_id: string }>(
    "SELECT user_id FROM events WHERE id = $1",
    [eventId],
  );
  const ownerId = owner?.user_id;
  // One batch, so arrivals for this attendee are serialized. The audit row is written first and only
  // when the stored state differs from the desired one: a repeated desired state must not create
  // duplicate arrival webhooks/audit entries after a lost response.
  const publicResponse = Boolean(parsed.data.rsvpResponseId);
  const table = publicResponse ? 'rsvp_responses' : 'guests';
  const identifier = parsed.data.inviteToken ? 'invite_token' : 'id';
  const metadata = publicResponse
    ? "json_object('rsvpResponseId', id, 'source', 'public_rsvp')"
    : "json_object('guestId', id, 'source', 'guest')";
  const [audit, updated] = await db.batch<{ id: string } & CheckInGuest>([
    {
      text: `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
       SELECT $2, $4, $5, ${metadata} FROM ${table}
        WHERE ${identifier} = $1 AND event_id = $2 ${publicResponse ? 'AND guest_id IS NULL' : ''}
          AND (checked_in_at IS NOT NULL) <> $3
       RETURNING id`,
      params: [parsed.data.rsvpResponseId ?? parsed.data.guestId ?? parsed.data.inviteToken, eventId, parsed.data.checkedIn, auth.user.id, parsed.data.checkedIn ? "guest_checked_in" : "guest_checked_out"],
    },
    updateCheckInGuestStatement(eventId, auth.user.id, parsed.data),
  ]);
  const guest: CheckInGuest | undefined = updated[0];
  if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  const changed = audit.length > 0;
  if (!changed) return NextResponse.json(guest);
  if (parsed.data.checkedIn) {
    await enqueueWebhookEvent(eventId, "guest.checked_in", {
      guest: { id: guest.id, name: guest.name, rsvp_status: guest.rsvp_status, checked_in_at: guest.checked_in_at, source: guest.source, headcount: guest.headcount },
    });
  }
  if (parsed.data.checkedIn && ownerId) {
    await recordActivationEventSafely({
      name: "first_guest_checked_in",
      userId: ownerId,
      eventId,
    });
  }
  return NextResponse.json(guest);
}

/** Someone at the door who isn't on the list: add them and record their arrival together. */
export async function POST(request: Request, { params }: Params) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "check_in_guests")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = walkInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the guest's name." }, { status: 400 });
  const { walkInId, name } = parsed.data;

  const find = () => db.queryOne<CheckInGuest & { event_id: string }>(
    "SELECT id, event_id, name, rsvp_status, checked_in_at, 'guest' AS source, 1 AS headcount FROM guests WHERE id = $1", [walkInId]);
  const asGuest = (row: CheckInGuest & { event_id: string }): CheckInGuest => ({
    id: row.id, name: row.name, rsvp_status: row.rsvp_status, checked_in_at: row.checked_in_at, source: row.source, headcount: row.headcount,
  });
  const existing = await find();
  if (existing) {
    if (existing.event_id !== eventId) return NextResponse.json({ error: "That didn't save. Try again." }, { status: 409 });
    return NextResponse.json(asGuest(existing));
  }
  const event = await db.queryOne<{ user_id: string; tier: string; status: string }>("SELECT user_id, tier, status FROM events WHERE id = $1", [eventId]);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const limit = getEffectiveEventLimits(await getUserTier(event.user_id), event.tier as EventTier).guests;
  try {
    await db.batch([
      guard("EXISTS (SELECT 1 FROM events WHERE id = $1 AND status = 'published')", [eventId], "not_live"),
      guard("(SELECT COUNT(*) FROM guests WHERE event_id = $1) < $2", [eventId, limit], "guest_limit"),
      {
        text: `INSERT INTO guests (id, event_id, name, rsvp_status, checked_in_at, checked_in_by) VALUES ($1, $2, $3, 'attending', ${SQL_NOW}, $4)`,
        params: [walkInId, eventId, name, auth.user.id],
      },
      {
        text: "INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata) VALUES ($1, $2, 'walk_in_added', $3)",
        params: [eventId, auth.user.id, JSON.stringify({ guestId: walkInId })],
      },
    ]);
  } catch (error) {
    const code = abortCode(error);
    if (code === "guest_limit") return NextResponse.json({ error: `This event is limited to ${limit} guests.` }, { status: 403 });
    if (code === "not_live") return NextResponse.json({ error: "Walk-ins can be added once the event is published." }, { status: 409 });
    // A double tap can lose the race to the same walk-in.
    const saved = await find();
    if (saved?.event_id === eventId) return NextResponse.json(asGuest(saved));
    return NextResponse.json({ error: "That didn't save. Try again." }, { status: 500 });
  }
  const guest = asGuest((await find())!);
  await enqueueWebhookEvent(eventId, "guest.checked_in", {
    guest: { id: guest.id, name: guest.name, rsvp_status: guest.rsvp_status, checked_in_at: guest.checked_in_at, source: guest.source, headcount: guest.headcount },
  });
  await recordActivationEventSafely({ name: "first_guest_checked_in", userId: event.user_id, eventId });
  return NextResponse.json(guest, { status: 201 });
}
