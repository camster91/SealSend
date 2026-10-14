import { NextResponse } from "next/server";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { getDb } from "@/lib/db/client";
import { enqueueWebhookEvent } from "@/lib/webhooks";
import { checkInSchema, listCheckInGuests, updateCheckInGuest } from '@/lib/check-in-store';

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "check_in_guests")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guests = await listCheckInGuests(async <T>(sql: string, values?: unknown[]) => ({ rows: (await getDb().query(sql, values)).rows as T[] }), eventId);
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

  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const ownerResult = await client.query<{ user_id: string }>(
      "SELECT user_id FROM events WHERE id = $1",
      [eventId],
    );
    const ownerId = ownerResult.rows[0]?.user_id;
    // Serialize arrivals for this attendee. A repeated desired state must not
    // create duplicate arrival webhooks/audit entries after a lost response.
    const publicResponse = Boolean(parsed.data.rsvpResponseId);
    const table = publicResponse ? 'rsvp_responses' : 'guests';
    const identifier = parsed.data.inviteToken ? 'invite_token' : 'id';
    const before = await client.query<{ checked_in_at: string | null }>(
      `SELECT checked_in_at FROM ${table} WHERE ${identifier} = $1 AND event_id = $2 ${publicResponse ? 'AND guest_id IS NULL' : ''} FOR UPDATE`,
      [parsed.data.rsvpResponseId ?? parsed.data.guestId ?? parsed.data.inviteToken, eventId],
    );
    const changed = before.rows.length > 0 && Boolean(before.rows[0].checked_in_at) !== parsed.data.checkedIn;
    const guest = await updateCheckInGuest(async <T>(sql: string, values?: unknown[]) => ({ rows: (await client.query(sql, values)).rows as T[] }), eventId, auth.user.id, parsed.data);
    if (!guest) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Guest not found" }, { status: 404 }); }
    if (!changed) { await client.query('COMMIT'); return NextResponse.json(guest); }
    await client.query(
      `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [eventId, auth.user.id, parsed.data.checkedIn ? "guest_checked_in" : "guest_checked_out", JSON.stringify(guest.source === 'public_rsvp' ? { rsvpResponseId: guest.id, source: guest.source } : { guestId: guest.id, source: guest.source })],
    );
    await client.query("COMMIT");
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
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
