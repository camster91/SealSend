import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, queryOne } from "@/lib/db/client";
import { ORGANIZATION_ROLES } from "@/lib/auth/event-access";
import { canManageMemberRole, requireOrganizationPermission } from "@/lib/auth/organization-access";

type RouteParams = { params: Promise<{ organizationId: string; userId: string }> };
const roleSchema = z.object({ role: z.enum(ORGANIZATION_ROLES) }).strict();

/** Runs a membership change and rolls back if it would leave the workspace without an owner. */
async function changeMembership(organizationId: string, change: (client: import("pg").PoolClient) => Promise<void>) {
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM organizations WHERE id = $1 FOR UPDATE", [organizationId]);
    await change(client);
    const owners = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM organization_members WHERE organization_id = $1 AND role = 'owner'",
      [organizationId],
    );
    if (Number(owners.rows[0]?.count ?? 0) === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function targetRole(organizationId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const row = await queryOne<{ role: string }>(
    "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
    [organizationId, userId],
  );
  return row?.role ?? null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { organizationId, userId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_members");
  if (auth.error) return auth.error;
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });

  const current = await targetRole(organizationId, userId);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageMemberRole(auth.role, current) || !canManageMemberRole(auth.role, parsed.data.role)) {
    return NextResponse.json({ error: "Only workspace owners can change owners and admins." }, { status: 403 });
  }

  const ok = await changeMembership(organizationId, async (client) => {
    await client.query(
      "UPDATE organization_members SET role = $3 WHERE organization_id = $1 AND user_id = $2",
      [organizationId, userId, parsed.data.role],
    );
  });
  if (!ok) return NextResponse.json({ error: "A workspace needs at least one owner." }, { status: 409 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { organizationId, userId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "view_organization");
  if (auth.error) return auth.error;

  const current = await targetRole(organizationId, userId);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const leavingSelf = userId === auth.user.id;
  if (!leavingSelf && !canManageMemberRole(auth.role, current)) {
    return NextResponse.json({ error: "You can't remove this member." }, { status: 403 });
  }

  const ok = await changeMembership(organizationId, async (client) => {
    await client.query("DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2", [organizationId, userId]);
  });
  if (!ok) return NextResponse.json({ error: "A workspace needs at least one owner. Make someone else an owner first." }, { status: 409 });
  return NextResponse.json({ success: true });
}
