import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_MEMBER_ROLES,
  ORGANIZATION_ROLES,
  getEventAccess,
  organizationRoleToEventRole,
  resolveEventAccessRole,
  roleCan,
} from "../src/lib/auth/event-access";

test("event roles expose the intended least-privilege permissions", () => {
  assert.deepEqual(EVENT_MEMBER_ROLES, ["manager", "check_in", "viewer"]);

  assert.equal(roleCan("owner", "manage_members"), true);
  assert.equal(roleCan("owner", "delete_event"), true);
  assert.equal(roleCan("manager", "edit_event"), true);
  assert.equal(roleCan("manager", "send_messages"), true);
  assert.equal(roleCan("manager", "manage_members"), false);
  assert.equal(roleCan("manager", "delete_event"), false);
  assert.equal(roleCan("check_in", "check_in_guests"), true);
  assert.equal(roleCan("check_in", "view_event"), true);
  assert.equal(roleCan("check_in", "view_guest_contacts"), false);
  assert.equal(roleCan("viewer", "view_event"), true);
  assert.equal(roleCan("viewer", "export_responses"), false);
});

test("resolves an owner before considering a membership role", async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const access = await getEventAccess(
    "user-1",
    "event-1",
    async (sql, params) => {
      calls.push({ sql, params });
      return { role: "owner" };
    },
  );

  assert.equal(access?.role, "owner");
  assert.match(calls[0].sql, /events[\s\S]*event_members/);
  assert.deepEqual(calls[0].params, ["event-1", "user-1"]);
});

test("fails closed for unknown or malformed persisted roles", async () => {
  const access = await getEventAccess(
    "user-1",
    "event-1",
    async () => ({ role: "administrator" }),
  );

  assert.equal(access, null);
  assert.equal(roleCan("administrator" as "owner", "view_event"), false);
});

test("workspace roles grant the matching access on every workspace event", () => {
  assert.deepEqual(ORGANIZATION_ROLES, ["owner", "admin", "planner", "check_in"]);
  assert.equal(organizationRoleToEventRole("owner"), "owner");
  assert.equal(organizationRoleToEventRole("admin"), "owner");
  assert.equal(organizationRoleToEventRole("planner"), "manager");
  assert.equal(organizationRoleToEventRole("check_in"), "check_in");
  assert.equal(organizationRoleToEventRole("superuser"), null);
  assert.equal(organizationRoleToEventRole(null), null);
});

test("the most privileged of event role and workspace role wins, and unknown roles never grant access", () => {
  assert.equal(resolveEventAccessRole("viewer", "planner"), "manager");
  assert.equal(resolveEventAccessRole("manager", "check_in"), "manager");
  assert.equal(resolveEventAccessRole(null, "admin"), "owner");
  assert.equal(resolveEventAccessRole("owner", null), "owner");
  assert.equal(resolveEventAccessRole("administrator", "superuser"), null);
  assert.equal(resolveEventAccessRole(null, null), null);
});

test("access lookups join workspace membership and accept workspace-only members", async () => {
  let sql = "";
  const access = await getEventAccess("user-2", "event-1", async (text) => {
    sql = text;
    return { role: null, organization_role: "planner" };
  });

  assert.equal(access?.role, "manager");
  assert.match(sql, /LEFT JOIN organization_members om/);
  assert.match(sql, /om\.user_id = \$2/);
});
