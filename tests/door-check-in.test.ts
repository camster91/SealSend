import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

process.env.SQLITE_PATH = ":memory:";
process.env.SESSION_SECRET ??= "test-session-secret-for-local-unit-tests";
delete process.env.MAILGUN_API_KEY;
delete process.env.MAILGUN_DOMAIN;

const { exec, query, queryOne } = await import("../src/lib/db/client");
const { withMobileContext } = await import("../src/lib/auth/mobile-context");
const { hashPassword } = await import("../src/lib/password");
const { mobileOperation } = await import("../src/lib/mobile/routes");
await exec(readFileSync("src/lib/db/schema.sql", "utf8"));

const account = async () => (await queryOne<{ id: string }>("INSERT INTO admin_users (email, password) VALUES ($1, 'x') RETURNING id", [`${randomUUID()}@example.test`]))!.id;
async function seed(status = "published") {
  const host = await account();
  const event = (await queryOne<{ id: string }>("INSERT INTO events (user_id, title, slug, status) VALUES ($1, 'Party', $2, $3) RETURNING id", [host, randomUUID(), status]))!.id;
  return { host, event };
}
async function walkIn(user: string, event: string, body: unknown) {
  const { POST } = await import("../src/app/api/events/[eventId]/check-in/route");
  return withMobileContext({ user: { id: user, email: "h@example.test", phone: null, role: "admin" as const }, sessionToken: "t" }, () =>
    POST(new Request("https://x.test", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ eventId: event }) }));
}

test("a walk-in is added and checked in, in one step", async () => {
  const { host, event } = await seed();
  const response = await walkIn(host, event, { walkInId: randomUUID(), name: "  Zoe Walker " });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.name, "Zoe Walker");
  assert.ok(body.checked_in_at);
  assert.equal(body.source, "guest");
  const row = await queryOne<{ rsvp_status: string; checked_in_by: string; email: string | null }>("SELECT rsvp_status, checked_in_by, email FROM guests WHERE event_id = $1", [event]);
  assert.deepEqual([row!.rsvp_status, row!.checked_in_by, row!.email], ["attending", host, null]);
  assert.equal((await query("SELECT id FROM event_audit_log WHERE event_id = $1 AND action = 'walk_in_added'", [event])).length, 1);
});

test("a repeated tap adds one person", async () => {
  const { host, event } = await seed();
  const walkInId = randomUUID();
  await walkIn(host, event, { walkInId, name: "Zoe" });
  const again = await walkIn(host, event, { walkInId, name: "Zoe" });
  assert.equal(again.status, 200);
  assert.equal((await query("SELECT id FROM guests WHERE event_id = $1", [event])).length, 1);
  assert.equal((await query("SELECT id FROM event_audit_log WHERE event_id = $1", [event])).length, 1);
});

test("an id from another event can't be reused", async () => {
  const one = await seed(), two = await seed();
  const walkInId = randomUUID();
  await walkIn(one.host, one.event, { walkInId, name: "Zoe" });
  assert.equal((await walkIn(two.host, two.event, { walkInId, name: "Zoe" })).status, 409);
  assert.equal((await query("SELECT id FROM guests WHERE event_id = $1", [two.event])).length, 0);
});

test("door staff can add walk-ins; viewers and strangers cannot", async () => {
  const { host, event } = await seed();
  const door = await account(), viewer = await account(), stranger = await account();
  await query("INSERT INTO event_members (event_id, user_id, role, invited_by) VALUES ($1, $2, 'check_in', $4), ($1, $3, 'viewer', $4)", [event, door, viewer, host]);
  assert.equal((await walkIn(door, event, { walkInId: randomUUID(), name: "A" })).status, 201);
  assert.equal((await walkIn(viewer, event, { walkInId: randomUUID(), name: "B" })).status, 404);
  assert.equal((await walkIn(stranger, event, { walkInId: randomUUID(), name: "C" })).status, 404);
});

test("walk-ins need a name, respect the guest limit and a live event", async () => {
  const { host, event } = await seed();
  for (const body of [null, {}, { walkInId: randomUUID(), name: "  " }, { walkInId: "x", name: "A" }, { walkInId: randomUUID(), name: "A".repeat(201) }]) {
    assert.equal((await walkIn(host, event, body)).status, 400);
  }
  for (let i = 0; i < 100; i++) await query("INSERT INTO guests (event_id, name) VALUES ($1, $2)", [event, `G${i}`]);
  assert.equal((await walkIn(host, event, { walkInId: randomUUID(), name: "Full" })).status, 403);
  const draft = await seed("archived");
  assert.equal((await walkIn(draft.host, draft.event, { walkInId: randomUUID(), name: "A" })).status, 409);
});

test("arrivals count people still to come, and not those who declined", async () => {
  const { arrivalCounts, sortForDoor } = await import("../src/lib/arrivals");
  const g = (name: string, rsvp_status: string, headcount: number, checked_in_at: string | null) => ({ id: name, name, rsvp_status, headcount, checked_in_at, source: "guest" as const });
  const list = [g("Ana", "attending", 2, "2026-01-01"), g("Ben", "attending", 3, null), g("Cy", "not_attending", 1, null), g("Di", "pending", 1, null)];
  assert.deepEqual(arrivalCounts(list), { here: 2, toCome: 3 });
  assert.deepEqual(sortForDoor(list).map((x) => x.name), ["Ben", "Di", "Cy", "Ana"]);
});

test("the app can sign in with a password and gets a revocable token, not cookies", async () => {
  assert.deepEqual(mobileOperation("POST", ["auth", "password"]), { operation: "passwordLogin" });
  const uuid = "00000000-0000-4000-8000-000000000011";
  assert.deepEqual(mobileOperation("POST", ["events", uuid, "check-in"]), { operation: "walkIn", eventId: uuid });
  await query("INSERT INTO admin_users (email, password) VALUES ('app@example.test', $1)", [await hashPassword("Str0ng-password!")]);
  const { POST } = await import("../src/app/api/auth/login-password/route");
  const login = (password: string) => withMobileContext({ user: null, sessionToken: null }, () =>
    (POST as unknown as (r: Request) => Promise<Response>)(new Request("https://x.test", { method: "POST", body: JSON.stringify({ email: "app@example.test", password }) })));
  assert.equal((await login("wrong")).status, 401);
  const response = await login("Str0ng-password!");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  const body = await response.json();
  assert.match(body.sessionToken, /^[0-9a-f-]{36}$/);
  assert.ok(body.expiresAt);
  assert.equal(body.user.role, "admin");
  assert.equal(body.user.password, undefined);
});
