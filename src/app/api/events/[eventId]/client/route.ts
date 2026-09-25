import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db/client";
import { requireEventPermission } from "@/lib/auth/event-api-access";

type RouteParams = { params: Promise<{ eventId: string }> };
const assignSchema = z.object({ clientId: z.string().uuid().nullable() }).strict();

/** Event client, the workspace's clients to choose from, and active review links. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { eventId } = await params;
  const auth = await requireEventPermission(eventId, "edit_event");
  if (auth.error) return auth.error;
  const event = await queryOne<{ client_id: string | null; organization_id: string | null }>(
    "SELECT client_id, organization_id FROM events WHERE id = $1",
    [eventId],
  );
  const clients = event?.organization_id
    ? await query<{ id: string; name: string }>("SELECT id, name FROM clients WHERE organization_id = $1 ORDER BY LOWER(name)", [event.organization_id])
    : [];
  const shares = await query(
    `SELECT id, token_preview, expires_at, approved_at, approver_name, created_at
       FROM event_client_shares WHERE event_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
    [eventId],
  );
  return NextResponse.json(
    { clientId: event?.client_id ?? null, organizationId: event?.organization_id ?? null, clients, shares },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { eventId } = await params;
  const auth = await requireEventPermission(eventId, "edit_event");
  if (auth.error) return auth.error;
  const parsed = assignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a client" }, { status: 400 });

  // The client must belong to the same workspace as the event.
  const updated = await query(
    `UPDATE events e SET client_id = $2, updated_at = NOW()
      WHERE e.id = $1
        AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM clients c WHERE c.id = $2 AND c.organization_id = e.organization_id))
      RETURNING e.id`,
    [eventId, parsed.data.clientId],
  );
  if (updated.length === 0) return NextResponse.json({ error: "That client isn't in this event's workspace." }, { status: 400 });
  await query(
    `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata) VALUES ($1, $2, 'client_assigned', $3::jsonb)`,
    [eventId, auth.user.id, JSON.stringify({ clientId: parsed.data.clientId })],
  );
  return NextResponse.json({ clientId: parsed.data.clientId });
}
