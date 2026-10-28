import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  BOOLEAN_COLUMNS,
  JSON_COLUMNS,
  TIMESTAMP_COLUMNS,
  abortCode,
  decodeRow,
  encodeParam,
  guard,
  sqlNowPlus,
  toSqlite,
} from "../src/lib/db/sqlite-dialect";

const schema = readFileSync("src/lib/db/schema.sql", "utf8");

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(schema);
  return db;
}

test("D1 schema loads twice, keeps every table and index, and has no foreign key problems", () => {
  const db = freshDb();
  db.exec(schema);
  const count = (type: string) =>
    (db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%'").get(type) as { n: number }).n;
  assert.equal(count("table"), 59);
  assert.equal(count("index"), 83);
  assert.equal(count("trigger"), 2);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("decoder column lists match the declared types in the D1 schema", () => {
  const db = freshDb();
  const byKind: Record<string, Set<string>> = { BOOLEAN: new Set(), TIMESTAMP_TEXT: new Set(), JSON_TEXT: new Set() };
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  for (const { name } of tables) {
    for (const column of db.prepare(`PRAGMA table_info(${name})`).all() as { name: string; type: string }[]) {
      byKind[column.type]?.add(column.name);
    }
  }
  assert.deepEqual([...BOOLEAN_COLUMNS].sort(), [...byKind.BOOLEAN].sort());
  assert.deepEqual([...TIMESTAMP_COLUMNS].sort(), [...byKind.TIMESTAMP_TEXT].sort());
  assert.deepEqual([...JSON_COLUMNS].sort(), [...byKind.JSON_TEXT].sort());
});

test("placeholders, parameters and rows convert between pg-style code and SQLite", () => {
  assert.equal(toSqlite("SELECT * FROM events WHERE id = $1 AND user_id = $2 OR owner = $1"), "SELECT * FROM events WHERE id = ?1 AND user_id = ?2 OR owner = ?1");
  assert.equal(encodeParam(true), 1);
  assert.equal(encodeParam(false), 0);
  assert.equal(encodeParam(undefined), null);
  assert.equal(encodeParam(new Date("2026-10-28T14:00:00Z")), "2026-10-28T14:00:00.000Z");
  assert.equal(encodeParam(["a", "b"]), '["a","b"]');
  assert.equal(encodeParam({ a: 1 }), '{"a":1}');

  const row = decodeRow<Record<string, unknown>>({
    allow_plus_ones: 1,
    created_at: "2026-10-28T14:00:00.000Z",
    customization: '{"theme":"dark"}',
    channels: '["email","sms"]',
    title: "[draft] party",
    checked_in_at: null,
  });
  assert.equal(row.allow_plus_ones, true);
  assert.ok(row.created_at instanceof Date);
  assert.deepEqual(row.customization, { theme: "dark" });
  assert.deepEqual(row.channels, ["email", "sms"]);
  assert.equal(row.title, "[draft] party");
  assert.equal(row.checked_in_at, null);
});

test("D1 schema keeps defaults, checks, cascades and both triggers", () => {
  const db = freshDb();
  const one = (sql: string, ...params: (string | number)[]) => db.prepare(sql).get(...params) as Record<string, unknown>;
  const run = (sql: string, ...params: (string | number)[]) => db.prepare(sql).run(...params);
  const rejects = (sql: string, ...params: (string | number)[]) => assert.throws(() => run(sql, ...params), /constraint/i, sql);

  run("INSERT INTO admin_users (email, password, name) VALUES ('a@example.com', 'x', 'Ada')");
  const user = one("SELECT * FROM admin_users") as { id: string; created_at: string };
  assert.match(user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(user.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  // New events join the owner's personal workspace, created once.
  run("INSERT INTO events (user_id, title, slug) VALUES (?, 'Party', 'party')", user.id);
  run("INSERT INTO events (user_id, title, slug) VALUES (?, 'Second', 'second')", user.id);
  const event = one("SELECT * FROM events WHERE slug = 'party'") as { id: string; organization_id: string; allow_plus_ones: number };
  const org = one("SELECT * FROM organizations") as { id: string; slug: string };
  assert.equal(event.organization_id, org.id);
  assert.equal(event.allow_plus_ones, 1);
  assert.equal(org.slug, `personal-${user.id.replaceAll("-", "")}`);
  assert.equal(one("SELECT count(*) AS n FROM organizations").n, 1);
  assert.equal(one("SELECT role FROM organization_members WHERE organization_id = ?", org.id).role, "owner");

  // Former Postgres CHECKs: IN lists, regexes rewritten as GLOB, array lengths.
  rejects("INSERT INTO events (user_id, title, slug, status) VALUES (?, 't', 's3', 'bogus')", user.id);
  rejects("INSERT INTO communication_suppressions (user_id, channel, recipient_hash, reason, provider) VALUES (?, 'email', 'XYZ', 'manual', 'manual')", user.id);
  run("INSERT INTO communication_suppressions (user_id, channel, recipient_hash, reason, provider) VALUES (?, 'email', ?, 'manual', 'manual')", user.id, "a".repeat(64));
  rejects("INSERT INTO brands (organization_id, name, primary_color) VALUES (?, 'b', '#12345G')", org.id);
  run("INSERT INTO brands (organization_id, name, primary_color) VALUES (?, 'b', '#12aBcF')", org.id);
  rejects("INSERT INTO organization_webhooks (organization_id, url, secret, events) VALUES (?, 'https://x', 's', '[]')", org.id);
  rejects("INSERT INTO event_social_polls (event_id, question, options) VALUES (?, 'q', '[1]')", event.id);
  const invite = "INSERT INTO beta_enrollment_invites (token_hash, token_preview, participant_label, segment, cohort_version, expires_at) VALUES (?, 'abcd', ?, 'repeat_planner', ?, '2030-01-01T00:00:00.000Z')";
  run(invite, "b".repeat(64), "host-0123456789ab", "beta-1");
  rejects(invite, "c".repeat(64), "host-XYZ", "beta-2");
  rejects(invite, "d".repeat(64), "host-0123456789ac", "-x");

  // Case-insensitive unique index.
  run("INSERT INTO waitlist_signups (email) VALUES ('A@x.com')");
  rejects("INSERT INTO waitlist_signups (email) VALUES ('a@X.com')");

  // Foreign keys, cascades and the photo cleanup queue.
  rejects("INSERT INTO guests (event_id, name) VALUES ('missing', 'g')");
  run("INSERT INTO guests (event_id, name) VALUES (?, 'Guest')", event.id);
  const guest = one("SELECT id FROM guests") as { id: string };
  run("INSERT INTO event_social_photos (event_id, guest_id, storage_path) VALUES (?, ?, 'u/social-private/p.webp')", event.id, guest.id);
  run("DELETE FROM events WHERE id = ?", event.id);
  assert.equal(one("SELECT count(*) AS n FROM guests").n, 0);
  assert.equal(one("SELECT storage_path FROM event_social_file_cleanup").storage_path, "u/social-private/p.webp");
});

test("local SQLite client decodes rows and rolls back a failed batch", async () => {
  process.env.SQLITE_PATH = ":memory:";
  const { getDb, query, queryOne, batch } = await import("../src/lib/db/client");
  getDb().exec(schema);

  const [created] = await query<{ id: string; created_at: Date }>(
    "INSERT INTO admin_users (email, password) VALUES ($1, $2) RETURNING id, created_at",
    ["host@example.com", "x"],
  );
  assert.ok(created.created_at instanceof Date);

  await query("INSERT INTO events (user_id, title, slug, customization, allow_plus_ones) VALUES ($1, $2, $3, $4, $5)", [
    created.id, "Party", "party", { theme: "dark" }, false,
  ]);
  const event = await queryOne<{ id: string; customization: unknown; allow_plus_ones: boolean }>("SELECT * FROM events WHERE slug = $1", ["party"]);
  assert.deepEqual(event?.customization, { theme: "dark" });
  assert.equal(event?.allow_plus_ones, false);

  await assert.rejects(
    batch([
      { text: "INSERT INTO guests (event_id, name) VALUES ($1, $2)", params: [event!.id, "Kept?"] },
      { text: "INSERT INTO guests (event_id, name) VALUES ($1, $2)", params: ["missing-event", "Breaks FK"] },
    ]),
    /FOREIGN KEY/,
  );
  assert.equal((await queryOne<{ n: number }>("SELECT count(*) AS n FROM guests"))?.n, 0);

  const [, rows] = await batch<{ name: string }>([
    { text: "INSERT INTO guests (event_id, name) VALUES ($1, $2)", params: [event!.id, "Ada"] },
    { text: "SELECT name FROM guests WHERE event_id = $1", params: [event!.id] },
  ]);
  assert.deepEqual(rows.map((row) => row.name), ["Ada"]);
});

test("a failed guard rolls back the whole batch and reports its code", async () => {
  process.env.SQLITE_PATH = ":memory:";
  const { query, queryOne, batch } = await import("../src/lib/db/client");
  await query("CREATE TABLE IF NOT EXISTS guard_seats (id INTEGER PRIMARY KEY, holder TEXT)");
  const takeSeat = (holder: string) => batch([
    { text: "INSERT INTO guard_seats (holder) VALUES ($1)", params: [holder] },
    guard("(SELECT count(*) FROM guard_seats) <= $1", [1], "capacity"),
    { text: "UPDATE guard_seats SET holder = upper(holder) WHERE holder = $1", params: [holder] },
  ]);

  await takeSeat("ada");
  const error = await takeSeat("bob").catch((caught: unknown) => caught);
  assert.equal(abortCode(error), "capacity");
  assert.equal(abortCode(new Error("disk I/O error")), null);
  assert.deepEqual((await query<{ holder: string }>("SELECT holder FROM guard_seats")).map((row) => row.holder), ["ADA"]);

  const later = await queryOne<{ later: string; now: string }>(`SELECT ${sqlNowPlus("+1 days")} AS later, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS now`);
  assert.ok(later!.later > later!.now);
  assert.throws(() => sqlNowPlus("1 day'; DROP TABLE x; --"));
});
