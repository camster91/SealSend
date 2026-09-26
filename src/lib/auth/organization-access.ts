import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { requireApiHost, type AuthenticatedUser } from "@/lib/auth/api-auth";
import { ORGANIZATION_ROLES, type OrganizationRole } from "@/lib/auth/event-access";
import { ORGANIZER_PLANS } from "@/lib/constants";

export type OrganizationPermission = "view_organization" | "manage_brand" | "manage_members" | "manage_clients" | "manage_integrations";

const ORGANIZATION_PERMISSIONS: Record<OrganizationRole, ReadonlySet<OrganizationPermission>> = {
  owner: new Set(["view_organization", "manage_brand", "manage_members", "manage_clients", "manage_integrations"]),
  admin: new Set(["view_organization", "manage_brand", "manage_members", "manage_clients", "manage_integrations"]),
  planner: new Set(["view_organization", "manage_clients"]),
  check_in: new Set(["view_organization"]),
};

export function organizationRoleCan(role: string, permission: OrganizationPermission): boolean {
  return (ORGANIZATION_ROLES as readonly string[]).includes(role)
    && ORGANIZATION_PERMISSIONS[role as OrganizationRole].has(permission);
}

/**
 * Members per workspace, including the owner. Organizer plan seats come from
 * ORGANIZER_PLANS; "personal" is the unpaid plan for both personal and team
 * workspaces.
 */
export const ORGANIZATION_SEAT_LIMITS: Record<string, number> = {
  personal: 2,
  solo: ORGANIZER_PLANS.solo.seats,
  studio: ORGANIZER_PLANS.studio.seats,
  agency: ORGANIZER_PLANS.agency.seats,
};

export function organizationSeatLimit(plan: string): number {
  return ORGANIZATION_SEAT_LIMITS[plan] ?? ORGANIZATION_SEAT_LIMITS.personal;
}

/** Roles an invite may grant; ownership is never handed out by invitation. */
export const INVITABLE_ORGANIZATION_ROLES = ["admin", "planner", "check_in"] as const;

/** Admins manage planners and check-in staff; only owners manage owners and admins. */
export function canManageMemberRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole === "planner" || targetRole === "check_in";
  return false;
}

export type OrganizationSummary = {
  id: string;
  name: string;
  plan: string;
  is_personal: boolean;
  role: OrganizationRole;
};

export async function listUserOrganizations(userId: string): Promise<OrganizationSummary[]> {
  return query<OrganizationSummary>(
    `SELECT o.id, o.name, o.plan, o.is_personal, m.role
       FROM organization_members m JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = $1
      ORDER BY o.is_personal DESC, o.name`,
    [userId],
  );
}

/** Ensures the host has a personal workspace (hosts without events may not have one yet). */
export async function ensurePersonalOrganization(userId: string): Promise<string | null> {
  const row = await queryOne<{ id: string | null }>("SELECT sealsend_personal_organization($1) AS id", [userId]);
  return row?.id ?? null;
}

export async function requireOrganizationPermission(organizationId: string, permission: OrganizationPermission): Promise<
  { user: AuthenticatedUser; role: OrganizationRole; error?: undefined }
  | { user?: undefined; role?: undefined; error: NextResponse }
> {
  const auth = await requireApiHost();
  if (auth.error) return { error: auth.error };
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const membership = await queryOne<{ role: string }>(
    "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
    [organizationId, auth.user.id],
  );
  if (!membership || !organizationRoleCan(membership.role, permission)) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { user: auth.user, role: membership.role as OrganizationRole };
}
