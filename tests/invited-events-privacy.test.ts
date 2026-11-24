import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.SQLITE_PATH = ":memory:";
delete process.env.MAILGUN_API_KEY;
delete process.env.MAILGUN_DOMAIN;

const { exec, query, queryOne } = await import("../src/lib/db/client");
const { getInvitedEvents } = await import("../src/lib/events");
await exec(readFileSync("src/lib/db/schema.sql", "utf8"));

const host = await queryOne<{ id: string }>("INSERT INTO admin_users (email, password) VALUES ('host@example.test', 'x') RETURNING id");
const event = await queryOne<{ id: string }>(
  "INSERT INTO events (user_id, title, slug, status) VALUES ($1, 'Private party', 'private-party', 'published') RETURNING id",
  [host!.id],
);
await query("INSERT INTO guests (event_id, name, email, phone) VALUES ($1, 'Guest', 'guest@example.test', '+14165550100')", [event!.id]);

test("an unproven password sign-up address reveals no invitations", async () => {
  assert.deepEqual(await getInvitedEvents("guest@example.test", null), []);
});

test("a verified phone still finds its invitations while email is off", async () => {
  assert.equal((await getInvitedEvents(null, "+14165550100")).length, 1);
});

test("email invitations are listed once an email provider proves addresses", async (t) => {
  process.env.MAILGUN_API_KEY = "test";
  process.env.MAILGUN_DOMAIN = "mg.example.test";
  t.after(() => { delete process.env.MAILGUN_API_KEY; delete process.env.MAILGUN_DOMAIN; });
  assert.equal((await getInvitedEvents("guest@example.test", null)).length, 1);
});
