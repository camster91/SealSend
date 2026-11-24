import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

process.env.SQLITE_PATH = ":memory:";
process.env.SESSION_SECRET ??= "test-session-secret-for-local-unit-tests";

const { exec, query, batch, queryOne } = await import("../src/lib/db/client");
const { withMobileContext } = await import("../src/lib/auth/mobile-context");
const { generateMagicToken } = await import("../src/lib/magic-token");
const { findRsvp, saveRsvp } = await import("../src/lib/rsvp-store");
await exec(readFileSync("src/lib/db/schema.sql", "utf8"));
const db = { query, batch };

async function seed() {
  const host = (await queryOne<{ id: string }>("INSERT INTO admin_users (email, password) VALUES ($1, 'x') RETURNING id", [`${randomUUID()}@example.test`]))!.id;
  const event = (await queryOne<{ id: string }>("INSERT INTO events (user_id, title, slug, status) VALUES ($1, 'Party', $2, 'published') RETURNING id", [host, randomUUID()]))!.id;
  return { host, event };
}
const addGuest = async (event: string, name: string, email: string | null = null) =>
  (await queryOne<{ id: string }>("INSERT INTO guests (event_id, name, email, invite_token) VALUES ($1, $2, $3, $4) RETURNING id", [event, name, email, randomUUID()]))!.id;
const reply = (event: string, token: string, name: string, email: string | undefined, status: "attending" | "not_attending" | "maybe" = "attending") =>
  saveRsvp(db, event, null, token, { respondent_name: name, respondent_email: email, status, headcount: 1, response_data: {}, plus_ones: [] } as never, null);
const as = <T>(id: string, run: () => Promise<T>) => withMobileContext({ user: { id, email: "h@example.test", phone: null, role: "admin" as const }, sessionToken: "t" }, run);
const unmatched = async (host: string, event: string) => {
  const { GET } = await import("../src/app/api/events/[eventId]/responses/unmatched/route");
  return as(host, () => GET(new Request("https://x.test"), { params: Promise.resolve({ eventId: event }) }));
};
const link = async (host: string, event: string, responseId: string, body: unknown) => {
  const { POST } = await import("../src/app/api/events/[eventId]/responses/[responseId]/link/route");
  return as(host, () => POST(new Request("https://x.test", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ eventId: event, responseId }) }));
};

test("shared-link replies suggest a guest but are never matched automatically", async () => {
  const { host, event } = await seed();
  const tom = await addGuest(event, "Tom Lee", "tom@example.test");
  await addGuest(event, "Sue Park");
  await reply(event, generateMagicToken(), "Tommy", "TOM@example.test");
  await reply(event, generateMagicToken(), " sue park ", undefined);
  await reply(event, generateMagicToken(), "Stranger", "new@example.test");
  const rows = await (await unmatched(host, event)).json();
  const by = Object.fromEntries(rows.map((row: { respondent_name: string }) => [row.respondent_name.trim(), row]));
  assert.equal(by.Tommy.suggested_guest_id, tom);
  assert.equal(by["sue park"].suggested_guest_name, "Sue Park");
  assert.equal(by.Stranger.suggested_guest_id, null);
  assert.equal((await queryOne<{ rsvp_status: string }>("SELECT rsvp_status FROM guests WHERE id = $1", [tom]))!.rsvp_status, "pending");
});

test("confirming a match counts the guest once and updates their status", async () => {
  const { host, event } = await seed();
  const tom = await addGuest(event, "Tom", "tom@example.test");
  const { response } = await reply(event, generateMagicToken(), "Tom", "tom@example.test", "not_attending");
  assert.equal((await link(host, event, response.id, { guestId: tom })).status, 200);
  assert.equal((await queryOne<{ rsvp_status: string }>("SELECT rsvp_status FROM guests WHERE id = $1", [tom]))!.rsvp_status, "not_attending");
  assert.deepEqual(await (await unmatched(host, event)).json(), []);
  const { listCheckInGuests } = await import("../src/lib/check-in-store");
  assert.equal((await listCheckInGuests(db, event)).length, 1);
  assert.equal((await query("SELECT id FROM event_audit_log WHERE event_id = $1 AND action = 'rsvp_matched'", [event])).length, 1);
});

test("a matched guest can still change their reply from their own device", async () => {
  const { host, event } = await seed();
  const tom = await addGuest(event, "Tom", "tom@example.test");
  const token = generateMagicToken();
  const { response } = await reply(event, token, "Tom", "tom@example.test");
  await link(host, event, response.id, { guestId: tom });
  assert.equal((await findRsvp(db, event, null, token))!.id, response.id);
  const saved = await reply(event, token, "Tom", "tom@example.test", "maybe");
  assert.equal(saved.response.id, response.id);
  assert.equal((await queryOne<{ rsvp_status: string }>("SELECT rsvp_status FROM guests WHERE id = $1", [tom]))!.rsvp_status, "maybe");
  assert.equal((await query("SELECT id FROM rsvp_responses WHERE event_id = $1", [event])).length, 1);
});

test("a reply is never moved onto someone who already replied, or between events", async () => {
  const { host, event } = await seed();
  const other = await seed();
  const tom = await addGuest(event, "Tom", "tom@example.test");
  const elsewhere = await addGuest(other.event, "Tom", "tom@example.test");
  const first = await reply(event, generateMagicToken(), "Tom", "tom@example.test");
  const second = await reply(event, generateMagicToken(), "Not Tom", "tom@example.test");
  assert.equal((await link(host, event, first.response.id, { guestId: elsewhere })).status, 409);
  assert.equal((await link(host, event, first.response.id, { guestId: tom })).status, 200);
  assert.equal((await link(host, event, second.response.id, { guestId: tom })).status, 409);
  assert.equal((await link(host, event, first.response.id, { guestId: tom })).status, 409);
  const rows = await (await unmatched(host, event)).json();
  assert.equal(rows[0].suggested_guest_id, null);
});

test("a new person can be added to the guest list so updates reach them", async () => {
  const { host, event } = await seed();
  const { response } = await reply(event, generateMagicToken(), "Priya", "Priya@Example.test");
  assert.equal((await link(host, event, response.id, { addGuest: true })).status, 200);
  const guest = await queryOne<{ id: string; name: string; email: string; rsvp_status: string }>("SELECT id, name, email, rsvp_status FROM guests WHERE event_id = $1", [event]);
  assert.deepEqual([guest!.name, guest!.email, guest!.rsvp_status], ["Priya", "priya@example.test", "attending"]);
  const { buildAudienceQuery } = await import("../src/lib/messages/audience");
  const audience = buildAudienceQuery(event, { rsvpStatuses: ["attending"], invitationStatuses: [], tagIds: [], unansweredOnly: false });
  assert.equal((await query(audience.sql, audience.params)).length, 1);
});

test("adding someone whose email is already listed asks the host to match instead", async () => {
  const { host, event } = await seed();
  await addGuest(event, "Tom", "tom@example.test");
  const { response } = await reply(event, generateMagicToken(), "Tom", "tom@example.test");
  assert.equal((await link(host, event, response.id, { addGuest: true })).status, 409);
});

test("only people who manage guests can see or match replies", async () => {
  const { event } = await seed();
  const stranger = await seed();
  const { response } = await reply(event, generateMagicToken(), "Tom", "tom@example.test");
  assert.equal((await unmatched(stranger.host, event)).status, 404);
  assert.equal((await link(stranger.host, event, response.id, { addGuest: true })).status, 404);
  assert.equal((await query("SELECT id FROM guests WHERE event_id = $1", [event])).length, 0);
});

test("the guest list is grouped by reply", async () => {
  const { replyGroup, replyCounts } = await import("../src/lib/reply-groups");
  assert.equal(replyGroup("attending"), "yes");
  assert.equal(replyGroup("not_attending"), "no");
  assert.equal(replyGroup("maybe"), "maybe");
  assert.equal(replyGroup(null), "waiting");
  assert.equal(replyGroup("pending"), "waiting");
  assert.deepEqual(replyCounts(["attending", "attending", null, "maybe"]), { all: 4, yes: 2, no: 0, maybe: 1, waiting: 1 });
});
