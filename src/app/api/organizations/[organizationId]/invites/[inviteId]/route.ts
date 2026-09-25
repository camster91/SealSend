import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { requireOrganizationPermission } from "@/lib/auth/organization-access";

type RouteParams = { params: Promise<{ organizationId: string; inviteId: string }> };

/** Revokes a pending workspace invitation. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { organizationId, inviteId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_members");
  if (auth.error) return auth.error;
  if (!/^[0-9a-f-]{36}$/i.test(inviteId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const removed = await query(
    "DELETE FROM organization_invites WHERE id = $1 AND organization_id = $2 AND accepted_at IS NULL RETURNING id",
    [inviteId, organizationId],
  );
  if (removed.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
