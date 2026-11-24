import { NextResponse } from "next/server";
import { z } from "zod";
import { batch, queryOne } from "@/lib/db/client";
import { abortCode, guard, type Statement } from "@/lib/db/sqlite-dialect";
import { ORGANIZATION_ROLES } from "@/lib/auth/event-access";
import { canManageMemberRole, requireOrganizationPermission } from "@/lib/auth/organization-access";

type RouteParams = { params: Promise<{ organizationId: string; userId: string }> };
const roleSchema = z.object({ role: z.enum(ORGANIZATION_ROLES) }).strict();

/** Roles an actor may change or remove (see canManageMemberRole). */
function manageableRoles(actorRole: string): string[] {
  return ORGANIZATION_ROLES.filter((role) => canManageMemberRole(actorRole, role));
}

/**
 * Runs a membership change as one batch. Guards re-check, when the batch runs, that the actor
 * still has their role and that the target's role is one the actor may manage (unless the actor
 * is leaving), and roll the change back if it would leave the workspace without an owner.
 */
async function changeMembership(
  input: { organizationId: string; userId: string; actorId: string; actorRole: string; leavingSelf: boolean },
  change: Statement,
): Promise<"ok" | "forbidden" | "no_owner"> {
  const { organizationId, userId, actorId, actorRole, leavingSelf } = input;
  const permissionGuards = [
    guard(
      "EXISTS (SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND role = $3)",
      [organizationId, actorId, actorRole],
      "forbidden",
    ),
  ];
  if (!leavingSelf) {
    permissionGuards.push(guard(
      `NOT EXISTS (SELECT 1 FROM organization_members
                    WHERE organization_id = $1 AND user_id = $2 AND role NOT IN (SELECT value FROM json_each($3)))`,
      [organizationId, userId, manageableRoles(actorRole)],
      "forbidden",
    ));
  }
  try {
    await batch([
      ...permissionGuards,
      change,
      guard(
        "EXISTS (SELECT 1 FROM organization_members WHERE organization_id = $1 AND role = 'owner')",
        [organizationId],
        "no_owner",
      ),
    ]);
    return "ok";
  } catch (error) {
    const code = abortCode(error);
    if (code === "forbidden" || code === "no_owner") return code;
    throw error;
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

  const result = await changeMembership(
    { organizationId, userId, actorId: auth.user.id, actorRole: auth.role, leavingSelf: false },
    {
      text: "UPDATE organization_members SET role = $3 WHERE organization_id = $1 AND user_id = $2",
      params: [organizationId, userId, parsed.data.role],
    },
  );
  if (result === "forbidden") {
    return NextResponse.json({ error: "Only workspace owners can change owners and admins." }, { status: 403 });
  }
  if (result === "no_owner") return NextResponse.json({ error: "A workspace needs at least one owner." }, { status: 409 });
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

  const result = await changeMembership(
    { organizationId, userId, actorId: auth.user.id, actorRole: auth.role, leavingSelf },
    { text: "DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2", params: [organizationId, userId] },
  );
  if (result === "forbidden") return NextResponse.json({ error: "You can't remove this member." }, { status: 403 });
  if (result === "no_owner") {
    return NextResponse.json({ error: "A workspace needs at least one owner. Make someone else an owner first." }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
