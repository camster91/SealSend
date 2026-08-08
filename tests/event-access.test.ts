import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_MEMBER_ROLES,
  getEventAccess,
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
