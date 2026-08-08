import { queryOne } from "@/lib/db/client";

export const EVENT_MEMBER_ROLES = ["manager", "check_in", "viewer"] as const;
export type EventMemberRole = (typeof EVENT_MEMBER_ROLES)[number];
export type EventAccessRole = "owner" | EventMemberRole;

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
) => Promise<{ role: string } | null>;

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
     END AS role
     FROM events e
     LEFT JOIN event_members em
       ON em.event_id = e.id AND em.user_id = $2
     WHERE e.id = $1
       AND (e.user_id = $2 OR em.user_id = $2)`,
    [eventId, userId],
  );

  if (!result || !(result.role === "owner" || EVENT_MEMBER_ROLES.includes(result.role as EventMemberRole))) {
    return null;
  }

  return { role: result.role as EventAccessRole };
}
