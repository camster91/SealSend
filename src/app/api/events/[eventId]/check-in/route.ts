import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { getDb, query } from "@/lib/db/client";

type Params = { params: Promise<{ eventId: string }> };
const checkInSchema = z.object({
  guestId: z.string().uuid().optional(),
  inviteToken: z.string().min(16).max(512).optional(),
  checkedIn: z.boolean(),
}).strict().refine((value) => Boolean(value.guestId) !== Boolean(value.inviteToken), "Provide exactly one guest identifier");

export async function GET(_request: Request, { params }: Params) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "check_in_guests")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guests = await query(
    `SELECT id, name, rsvp_status, checked_in_at
     FROM guests WHERE event_id = $1 ORDER BY checked_in_at DESC NULLS LAST, name ASC LIMIT 1000`,
    [eventId],
  );
  return NextResponse.json(guests);
}

export async function PATCH(request: Request, { params }: Params) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "check_in_guests")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = checkInSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid check-in request" }, { status: 400 });

  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const identifierClause = parsed.data.guestId ? "id = $1" : "invite_token = $1";
    const identifier = parsed.data.guestId ?? parsed.data.inviteToken;
    const result = await client.query(
      `UPDATE guests SET checked_in_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
         checked_in_by = CASE WHEN $3 THEN $4 ELSE NULL END, updated_at = NOW()
       WHERE ${identifierClause} AND event_id = $2
       RETURNING id, name, rsvp_status, checked_in_at`,
      [identifier, eventId, parsed.data.checkedIn, auth.user.id],
    );
    const guest = result.rows[0];
    if (!guest) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Guest not found" }, { status: 404 }); }
    await client.query(
      `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [eventId, auth.user.id, parsed.data.checkedIn ? "guest_checked_in" : "guest_checked_out", JSON.stringify({ guestId: guest.id })],
    );
    await client.query("COMMIT");
    return NextResponse.json(guest);
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
