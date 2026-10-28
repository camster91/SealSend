import { NextResponse } from "next/server";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import * as db from "@/lib/db/client";
import { enqueueWebhookEvent } from "@/lib/webhooks";
import { checkInSchema, listCheckInGuests, updateCheckInGuestStatement, type CheckInGuest } from '@/lib/check-in-store';

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
