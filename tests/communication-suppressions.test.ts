import assert from "node:assert/strict";
import test from "node:test";

import {
  communicationSuppressionKey,
  isCommunicationSuppressed,
  normalizeCommunicationRecipient,
} from "../src/lib/communication-suppressions";
import {
  normalizeTwilioOptOutType,
  processTwilioOptOutEvent,
} from "../src/lib/twilio-inbound-opt-out";
import { openTestDb } from "../src/lib/db/sqlite-local";

const OWNER_A = "00000000-0000-4000-8000-0000000000a1";
const OWNER_B = "00000000-0000-4000-8000-0000000000b1";
const EVENT_A_OLD = "00000000-0000-4000-8000-0000000000a2";
const EVENT_A_NEW = "00000000-0000-4000-8000-0000000000a3";
const EVENT_B = "00000000-0000-4000-8000-0000000000b2";

/** Two organizers with the number on their guest lists (owner A on two events). */
async function optOutDb() {
  const db = openTestDb();
  await db.query("INSERT INTO admin_users (id, email, password) VALUES ($1, 'a@example.com', 'x'), ($2, 'b@example.com', 'x')", [OWNER_A, OWNER_B]);
  await db.query(
    `INSERT INTO events (id, user_id, title, slug, created_at) VALUES
       ($1, $4, 'Old', 'old', '2026-01-01T00:00:00.000Z'),
       ($2, $4, 'New', 'new', '2026-06-01T00:00:00.000Z'),
       ($3, $5, 'B', 'b', '2026-03-01T00:00:00.000Z')`,
    [EVENT_A_OLD, EVENT_A_NEW, EVENT_B, OWNER_A, OWNER_B],
  );
  await db.query(
    "INSERT INTO guests (name, event_id, phone) VALUES ('G1', $1, $4), ('G2', $2, $4), ('G3', $3, $4), ('Other', $3, '+14165550199')",
    [EVENT_A_OLD, EVENT_A_NEW, EVENT_B, "+14165550123"],
  );
  return db;
}

async function suppressionRows(db: Awaited<ReturnType<typeof optOutDb>>) {
  return db.query<{ user_id: string; channel: string; recipient_hash: string; reason: string; source_event_id: string }>(
    "SELECT user_id, channel, recipient_hash, reason, source_event_id FROM communication_suppressions ORDER BY user_id",
  );
}

test("email suppressions are case-insensitive and store only a hash key", () => {
  const first = communicationSuppressionKey("email", " Guest@Example.COM ");
  const second = communicationSuppressionKey("email", "guest@example.com");

  assert.equal(first, second);
  assert.match(first, /^email:[a-f0-9]{64}$/);
  assert.equal(first.includes("guest@example.com"), false);
});

test("SMS suppressions ignore presentation punctuation", () => {
  assert.equal(
    normalizeCommunicationRecipient("sms", "+1 (416) 555-0123"),
    "+14165550123",
  );
  assert.equal(
    communicationSuppressionKey("sms", "+1 (416) 555-0123"),
    communicationSuppressionKey("sms", "+14165550123"),
  );
});

test("suppression lookup stays channel-specific", () => {
  const suppressions = new Set([communicationSuppressionKey("email", "guest@example.com")]);

  assert.equal(isCommunicationSuppressed(suppressions, "email", "GUEST@example.com"), true);
  assert.equal(isCommunicationSuppressed(suppressions, "sms", "+14165550123"), false);
});

test("Twilio OptOutType accepts only STOP, START, and HELP", () => {
  assert.equal(normalizeTwilioOptOutType("stop"), "STOP");
  assert.equal(normalizeTwilioOptOutType(" START "), "START");
  assert.equal(normalizeTwilioOptOutType("HELP"), "HELP");
  assert.equal(normalizeTwilioOptOutType("UNSUBSCRIBE"), null);
  assert.equal(normalizeTwilioOptOutType(undefined), null);
});

test("Twilio STOP records a hashed SMS suppression for every matching organizer", async () => {
  const db = await optOutDb();
  try {
    const result = await processTwilioOptOutEvent({ messageSid: "SM-stop", from: "+1 (416) 555-0123", optOutType: "STOP" }, db);
    assert.deepEqual(result, { handled: true, duplicate: false, optOutType: "STOP", ownerCount: 2 });
    const rows = await suppressionRows(db);
    assert.deepEqual(rows.map((row) => [row.user_id, row.source_event_id]), [[OWNER_A, EVENT_A_NEW], [OWNER_B, EVENT_B]]);
    const hash = communicationSuppressionKey("sms", "+14165550123").split(":")[1];
    assert.ok(rows.every((row) => row.channel === "sms" && row.reason === "unsubscribed" && row.recipient_hash === hash));
    assert.ok(await db.queryOne("SELECT 1 FROM webhook_receipts WHERE provider = 'twilio' AND event_id = 'inbound:SM-stop:STOP'"));
  } finally { db.handle.close(); }
});

test("Twilio START removes every local suppression for the recipient hash", async () => {
  const db = await optOutDb();
  try {
    await processTwilioOptOutEvent({ messageSid: "SM-stop", from: "+14165550123", optOutType: "STOP" }, db);
    const result = await processTwilioOptOutEvent({ messageSid: "SM-start", from: "+14165550123", optOutType: "START" }, db);
    assert.deepEqual(result, { handled: true, duplicate: false, optOutType: "START", ownerCount: 0 });
    assert.deepEqual(await suppressionRows(db), []);
  } finally { db.handle.close(); }
});

test("Twilio HELP is replay-safe and does not change suppression state", async () => {
  const db = await optOutDb();
  try {
    const result = await processTwilioOptOutEvent({ messageSid: "SM-help", from: "+14165550123", optOutType: "HELP" }, db);
    assert.deepEqual(result, { handled: true, duplicate: false, optOutType: "HELP", ownerCount: 0 });
    assert.deepEqual(await suppressionRows(db), []);
    assert.equal((await db.query("SELECT event_id FROM webhook_receipts")).length, 1);
  } finally { db.handle.close(); }
});

test("duplicate and unsupported Twilio opt-out events do not mutate suppressions", async () => {
  const db = await optOutDb();
  try {
    await processTwilioOptOutEvent({ messageSid: "SM-duplicate", from: "+14165550123", optOutType: "STOP" }, db);
    await db.query("DELETE FROM communication_suppressions");
    assert.deepEqual(
      await processTwilioOptOutEvent({ messageSid: "SM-duplicate", from: "+14165550123", optOutType: "STOP" }, db),
      { handled: true, duplicate: true, optOutType: "STOP", ownerCount: 0 },
    );
    assert.deepEqual(await suppressionRows(db), []);
    assert.deepEqual(
      await processTwilioOptOutEvent({ messageSid: "SM-ordinary", from: "+14165550123", optOutType: "ordinary message" }, db),
      { handled: false, duplicate: false, optOutType: null, ownerCount: 0 },
    );
    assert.equal((await db.query("SELECT event_id FROM webhook_receipts")).length, 1);
  } finally { db.handle.close(); }
});

test("a failed write leaves no receipt, so Twilio's retry is processed", async () => {
  const db = await optOutDb();
  try {
    const failing = { query: db.query, batch: async () => { throw new Error("D1 unavailable"); } };
    await assert.rejects(processTwilioOptOutEvent({ messageSid: "SM-retry", from: "+14165550123", optOutType: "STOP" }, failing));
    assert.equal((await db.query("SELECT event_id FROM webhook_receipts")).length, 0);
    const retry = await processTwilioOptOutEvent({ messageSid: "SM-retry", from: "+14165550123", optOutType: "STOP" }, db);
    assert.equal(retry.duplicate, false);
    assert.equal((await suppressionRows(db)).length, 2);
  } finally { db.handle.close(); }
});
