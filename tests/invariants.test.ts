import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openSqliteDb } from "../src/lib/db/sqlite-local";
import { attendingPeopleSql, awaitingReplyCountSql, walkInCountSql } from "../src/lib/event-stats";
import { hasUploadPrefixReferenceSql, isUploadPathReferencedSql } from "../src/lib/asset-references";
import { listCheckInGuests } from "../src/lib/check-in-store";
import { arrivalCounts } from "../src/lib/arrivals";
import { buildRsvpSummary, type SummaryResponse } from "../src/lib/rsvp-summary";
import { replyCounts } from "../src/lib/reply-groups";
import { listUnmatchedReplies } from "../src/lib/rsvp-match";

const SCHEMA_SQL = readFileSync("src/lib/db/schema.sql", "utf8");

test("cross-feature invariant: Overview, Guest List, Summary, Check-in, and Client totals agree across plus-ones, public replies, walk-ins, and deletions", async () => {
  const db = openSqliteDb(":memory:");
  await db.exec(SCHEMA_SQL);

  const hostId = "11111111-1111-4111-8111-111111111111";
  const eventId = "22222222-2222-4222-8222-222222222222";
  const gInvitedReplied = "33333333-3333-4333-8333-333333333331";
  const gInvitedWaiting = "33333333-3333-4333-8333-333333333332";
  const gWalkIn = "33333333-3333-4333-8333-333333333333";
  const rInvited = "44444444-4444-4444-8444-444444444441";
  const rPublic = "44444444-4444-4444-8444-444444444442";

  await db.query("INSERT INTO admin_users (id, email, password, name) VALUES ($1, 'host@test.example', 'hash', 'Host')", [hostId]);
  await db.query("INSERT INTO events (id, user_id, title, slug, status, max_attendees) VALUES ($1, $2, 'Gala', 'gala-inv', 'published', 10)", [eventId, hostId]);

  // 1 invited guest attending with headcount 3 (self + 2 plus-ones)
  await db.query("INSERT INTO guests (id, event_id, name, email, rsvp_status) VALUES ($1, $2, 'Alice', 'alice@test.example', 'attending')", [gInvitedReplied, eventId]);
  await db.query("INSERT INTO rsvp_responses (id, event_id, guest_id, respondent_name, respondent_email, status, headcount) VALUES ($1, $2, $3, 'Alice', 'alice@test.example', 'attending', 3)", [rInvited, eventId, gInvitedReplied]);
  // 1 invited guest still waiting
  await db.query("INSERT INTO guests (id, event_id, name, email, rsvp_status) VALUES ($1, $2, 'Bob', 'bob@test.example', 'pending')", [gInvitedWaiting, eventId]);
  // 1 door walk-in (attending, checked in, no rsvp_responses row)
  await db.query("INSERT INTO guests (id, event_id, name, rsvp_status, checked_in_at) VALUES ($1, $2, 'Walk-in Pat', 'attending', '2026-11-25T10:00:00.000Z')", [gWalkIn, eventId]);
  // 1 public RSVP attending with headcount 2
  await db.query("INSERT INTO rsvp_responses (id, event_id, guest_id, respondent_name, status, headcount) VALUES ($1, $2, NULL, 'Public Sam', 'attending', 2)", [rPublic, eventId]);

  // Expected: 3 + 1 (walk-in) + 2 (public) = 6 people attending; 1 invited guest awaiting reply.
  const stats = await db.queryOne<{ attending: number; awaiting: number; walkins: number }>(
    `SELECT ${attendingPeopleSql("e.id")} AS attending,
            ${awaitingReplyCountSql("e.id")} AS awaiting,
            ${walkInCountSql("e.id")} AS walkins
       FROM events e WHERE e.id = $1`,
    [eventId],
  );
  assert.deepEqual(stats, { attending: 6, awaiting: 1, walkins: 1 });

  // Door check-in totals: 1 here + 5 toCome = 6 total attending people.
  const door = await listCheckInGuests(db, eventId);
  const arrivals = arrivalCounts(door);
  assert.equal(arrivals.here + arrivals.toCome, 6);
  assert.deepEqual(arrivals, { here: 1, toCome: 5 });

  // RSVP summary agrees on attendingHeadcount (6) and remaining capacity (4 of 10).
  const responses = await db.query<SummaryResponse>("SELECT id, status, headcount, respondent_name, respondent_email, response_data FROM rsvp_responses WHERE event_id = $1", [eventId]);
  const summary = buildRsvpSummary(responses, [], 10, stats!.walkins);
  assert.equal(summary.attendingHeadcount, 6);
  assert.equal(summary.capacity?.remaining, 4);

  // Guest list status classification never marks the door walk-in as "waiting".
  const guestStatuses = await db.query<{ reply_status: string | null }>(
    `SELECT COALESCE(
        (SELECT r.status FROM rsvp_responses r WHERE r.event_id = guests.event_id AND r.guest_id = guests.id ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC LIMIT 1),
        NULLIF(guests.rsvp_status, 'pending')
      ) AS reply_status
     FROM guests WHERE event_id = $1`,
    [eventId],
  );
  const grouped = replyCounts(guestStatuses.map((g) => g.reply_status));
  assert.equal(grouped.yes, 2); // Alice + Walk-in Pat
  assert.equal(grouped.waiting, 1); // Only Bob

  // Deleting an invited guest atomically removes their linked RSVP (no phantom public reply).
  await db.batch([
    { text: "DELETE FROM rsvp_responses WHERE event_id = $1 AND guest_id = $2", params: [eventId, gInvitedReplied] },
    { text: "DELETE FROM guests WHERE id = $1 AND event_id = $2", params: [gInvitedReplied, eventId] },
  ]);
  const unmatchedAfterDelete = await listUnmatchedReplies(db, eventId);
  assert.equal(unmatchedAfterDelete.length, 1);
  assert.equal(unmatchedAfterDelete[0].id, rPublic);
  const statsAfterDelete = await db.queryOne<{ attending: number }>(`SELECT ${attendingPeopleSql("$1")} AS attending`, [eventId]);
  assert.equal(statsAfterDelete?.attending, 3); // Walk-in (1) + Public Sam (2)
});

test("cross-feature invariant: asset reference SQL protects covers, logos, backgrounds, audio, brands, and social photos", async () => {
  const db = openSqliteDb(":memory:");
  await db.exec(SCHEMA_SQL);

  const userId = "11111111-1111-4111-8111-111111111112";
  const eventId = "22222222-2222-4222-8222-222222222223";
  const orgId = "55555555-5555-4555-8555-555555555555";
  await db.query("INSERT INTO admin_users (id, email, password) VALUES ($1, 'assets@test.example', 'hash')", [userId]);
  await db.query("INSERT INTO organizations (id, name, slug, is_personal, created_by) VALUES ($1, 'Studio', 'studio-inv', 0, $2)", [orgId, userId]);
  await db.query(
    "INSERT INTO events (id, user_id, organization_id, title, slug, design_url, customization) VALUES ($1, $2, $3, 'Show', 'show-inv', $4, $5)",
    [
      eventId,
      userId,
      orgId,
      `/uploads/${userId}/cover.webp`,
      JSON.stringify({
        logoUrl: `/uploads/${userId}/logo.webp`,
        backgroundImage: `/uploads/${userId}/bg.webp`,
        audioUrl: `/uploads/${userId}/song.mp3`,
      }),
    ],
  );
  await db.query("INSERT INTO brands (organization_id, name, logo_url) VALUES ($1, 'Brand', $2)", [orgId, `/uploads/${userId}/brand.webp`]);

  for (const [idx, path] of [
    `/uploads/${userId}/cover.webp`,
    `/uploads/${userId}/logo.webp`,
    `/uploads/${userId}/bg.webp`,
    `/uploads/${userId}/song.mp3`,
    `/uploads/${userId}/brand.webp`,
    `/uploads/${userId}/orphan.webp`,
  ].entries()) {
    await db.query(
      "INSERT INTO upload_assets (id, user_id, path, byte_size, media_type, created_at) VALUES ($1, $2, $3, 100, 'image', '2020-01-01T00:00:00.000Z')",
      [`66666666-6666-4666-8666-66666666666${idx}`, userId, path],
    );
  }

  const orphans = await db.query<{ path: string }>(
    `SELECT a.path FROM upload_assets a WHERE NOT ${isUploadPathReferencedSql("a.path")}`,
  );
  assert.deepEqual(orphans.map((o) => o.path), [`/uploads/${userId}/orphan.webp`]);

  const prefixInUse = await db.query(hasUploadPrefixReferenceSql("$1"), [`/uploads/${userId}/%`]);
  assert.equal(prefixInUse.length, 1);
});
