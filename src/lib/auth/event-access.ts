import { queryOne } from "@/lib/db/client";

export const EVENT_MEMBER_ROLES = ["manager", "check_in", "viewer"] as const;
export type EventMemberRole = (typeof EVENT_MEMBER_ROLES)[number];
export type EventAccessRole = "owner" | EventMemberRole;

export const ORGANIZATION_ROLES = ["owner", "admin", "planner", "check_in"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

// What a workspace role grants on every event the workspace owns.
const ORGANIZATION_EVENT_ROLE: Record<OrganizationRole, EventAccessRole> = {
  owner: "owner",
  admin: "owner",
  planner: "manager",
  check_in: "check_in",
};

const ACCESS_RANK: Record<EventAccessRole, number> = { owner: 3, manager: 2, check_in: 1, viewer: 0 };

export function organizationRoleToEventRole(role: string | null | undefined): EventAccessRole | null {
  return role && Object.prototype.hasOwnProperty.call(ORGANIZATION_EVENT_ROLE, role)
    ? ORGANIZATION_EVENT_ROLE[role as OrganizationRole]
    : null;
}

function eventRoleOrNull(role: string | null | undefined): EventAccessRole | null {
  return role === "owner" || EVENT_MEMBER_ROLES.includes(role as EventMemberRole) ? role as EventAccessRole : null;
}

/** The most privileged of the direct event role and the workspace role. */
export function resolveEventAccessRole(eventRole: string | null | undefined, organizationRole: string | null | undefined): EventAccessRole | null {
  const candidates = [eventRoleOrNull(eventRole), organizationRoleToEventRole(organizationRole)]
    .filter((role): role is EventAccessRole => role !== null);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, role) => ACCESS_RANK[role] > ACCESS_RANK[best] ? role : best);
}

export type EventPermission =
  | "view_event"
  | "edit_event"
  | "manage_guests"
  | "view_guest_contacts"
  | "send_messages"
  | "check_in_guests"
  | "export_responses"
  | "manage_members"
  | "manage_billing"
  | "clone_event"
  | "delete_event";

const ROLE_PERMISSIONS: Record<EventAccessRole, ReadonlySet<EventPermission>> = {
  owner: new Set([
    "view_event",
    "edit_event",
    "manage_guests",
    "view_guest_contacts",
    "send_messages",
    "check_in_guests",
    "export_responses",
    "manage_members",
    "manage_billing",
    "clone_event",
    "delete_event",
  ]),
  manager: new Set([
    "view_event",
    "edit_event",
    "manage_guests",
    "view_guest_contacts",
    "send_messages",
    "check_in_guests",
    "export_responses",
  ]),
  check_in: new Set(["view_event", "check_in_guests"]),
  viewer: new Set(["view_event"]),
};

export interface EventAccess {
  role: EventAccessRole;
}

type AccessQuery = (
  sql: string,
  params?: unknown[],
) => Promise<{ role: string | null; organization_role?: string | null } | null>;

export function roleCan(role: EventAccessRole, permission: EventPermission): boolean {
  return Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)
    && ROLE_PERMISSIONS[role].has(permission);
}

export async function getEventAccess(
  userId: string,
  eventId: string,
  execute: AccessQuery = (sql, params) => queryOne<{ role: string }>(sql, params),
): Promise<EventAccess | null> {
  const result = await execute(
    `SELECT CASE
       WHEN e.user_id = $2 THEN 'owner'
       ELSE em.role
     END AS role,
     om.role AS organization_role
     FROM events e
     LEFT JOIN event_members em
       ON em.event_id = e.id AND em.user_id = $2
     LEFT JOIN organization_members om
       ON om.organization_id = e.organization_id AND om.user_id = $2
     WHERE e.id = $1
       AND (e.user_id = $2 OR em.user_id = $2 OR om.user_id = $2)`,
    [eventId, userId],
  );

  const role = result ? resolveEventAccessRole(result.role, result.organization_role) : null;
  return role ? { role } : null;
}
