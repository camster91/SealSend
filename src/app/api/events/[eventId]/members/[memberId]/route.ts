import { NextResponse } from "next/server";

import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { queryOne } from "@/lib/db/client";
import { eventMemberRoleSchema } from "@/lib/validations";

type Params = { params: Promise<{ eventId: string; memberId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { eventId, memberId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "manage_members")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = eventMemberRoleSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const member = await queryOne(
    `UPDATE event_members SET role = $1, updated_at = NOW()
     WHERE id = $2 AND event_id = $3
     RETURNING id, user_id, role, updated_at`,
    [parsed.data.role, memberId, eventId],
  );
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await queryOne(
    `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
     VALUES ($1, $2, 'member_role_changed', $3::jsonb) RETURNING id`,
    [eventId, auth.user.id, JSON.stringify({ memberId, role: parsed.data.role })],
  );
  return NextResponse.json(member);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { eventId, memberId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "manage_members")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const removed = await queryOne<{ user_id: string }>(
    "DELETE FROM event_members WHERE id = $1 AND event_id = $2 RETURNING user_id",
    [memberId, eventId],
  );
  if (!removed) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await queryOne(
    `INSERT INTO event_audit_log (event_id, actor_user_id, action, target_user_id)
     VALUES ($1, $2, 'member_removed', $3) RETURNING id`,
    [eventId, auth.user.id, removed.user_id],
  );
  return NextResponse.json({ success: true });
}
