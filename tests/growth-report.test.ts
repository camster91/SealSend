import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGrowthReport,
  growthReportSql,
  normalizeGrowthChannel,
  shapeGrowthReport,
} from "../src/lib/analytics/growth-report";

const NOW = new Date("2026-10-10T12:00:00.000Z");

test("normalizes only the approved acquisition channels", () => {
  assert.equal(normalizeGrowthChannel("organic_search"), "organic_search");
  assert.equal(normalizeGrowthChannel(" SOCIAL "), "social");
  assert.equal(normalizeGrowthChannel("paid_search"), "unknown");
  assert.equal(normalizeGrowthChannel(null), "unknown");
});

test("shapes anonymous pageviews and signup cohorts without exposing identities", () => {
  const report = shapeGrowthReport(
    [
      { day: "2026-10-10", channel: "direct", views: "4" },
      { day: "2026-10-09", channel: "organic_search", views: 3 },
      { day: "2026-10-10", channel: "legacy_campaign", views: 2 },
      { day: "2026-10-11", channel: "social", views: 99 },
    ],
    [
      {
        user_id: "host-a",
        account_created_at: "2026-10-01T10:00:00.000Z",
        channel: "social",
        event_published_at: "2026-10-02T10:00:00.000Z",
        first_rsvp_received_at: "2026-10-03T10:00:00.000Z",
      },
      {
        user_id: "host-b",
        account_created_at: "2026-10-09T10:00:00.000Z",
        channel: "email",
      },
      { user_id: null, account_created_at: "2026-10-01T10:00:00.000Z", channel: "direct" },
      { user_id: "future-host", account_created_at: "2026-10-11T10:00:00.000Z", channel: "direct" },
    ],
    NOW,
  );

  assert.equal(report.landingPageviews.total, 9);
  assert.deepEqual(report.landingPageviews.byChannel, {
    direct: 4,
    organic_search: 3,
    social: 0,
    email: 0,
    referral: 0,
    unknown: 2,
  });
  assert.equal(report.signupCohorts.total, 2);
  assert.deepEqual(report.signupCohorts.byChannel, {
    direct: 0,
    organic_search: 0,
    social: 1,
    email: 1,
    referral: 0,
    unknown: 0,
  });
  assert.deepEqual(report.signupCohorts.byDay.map(({ day, total }) => ({ day, total })), [
    { day: "2026-10-01", total: 1 },
    { day: "2026-10-09", total: 1 },
  ]);
  assert.deepEqual(report.ownerActivations, {
    eventPublished: { numerator: 1, denominator: 2, rate: 0.5 },
    firstRsvpReceived: { numerator: 1, denominator: 2, rate: 0.5 },
  });
  assert.equal(JSON.stringify(report).includes("host-a"), false);
  assert.equal(JSON.stringify(report).includes("future-host"), false);
});

test("uses seven-day mature hosts as denominators and does not sum milestone events", () => {
  const report = shapeGrowthReport(
    [],
    [
      {
        user_id: "mature-host",
        account_created_at: "2026-10-01T10:00:00.000Z",
        channel: "direct",
        event_published_at: "2026-10-09T10:00:00.000Z",
        first_rsvp_received_at: "2026-10-10T10:00:00.000Z",
      },
      // Duplicate telemetry for the same host remains one cohort member.
      {
        user_id: "mature-host",
        account_created_at: "2026-10-01T11:00:00.000Z",
        channel: "direct",
        event_published_at: "2026-10-04T10:00:00.000Z",
        first_rsvp_received_at: "2026-10-05T10:00:00.000Z",
      },
      {
        user_id: "recent-host",
        account_created_at: "2026-10-08T10:00:00.000Z",
        channel: "referral",
        event_published_at: "2026-10-09T10:00:00.000Z",
        first_rsvp_received_at: "2026-10-10T10:00:00.000Z",
      },
      {
        user_id: "mature-no-progress",
        account_created_at: "2026-09-20T10:00:00.000Z",
        channel: "referral",
      },
    ],
    NOW,
  );

  assert.deepEqual(report.sevenDayMatureCohort.matureShare, { numerator: 2, denominator: 3, rate: 2 / 3 });
  assert.deepEqual(report.sevenDayMatureCohort.eventPublished, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(report.sevenDayMatureCohort.firstRsvpReceived, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(report.sevenDayMatureCohort.byChannel.direct.eventPublished, { numerator: 1, denominator: 1, rate: 1 });
  assert.deepEqual(report.sevenDayMatureCohort.byChannel.referral.firstRsvpReceived, { numerator: 0, denominator: 1, rate: 0 });
  assert.match(report.limitations.join(" "), /not limited to the first seven days/);
});

test("returns null rates for an empty or immature cohort", () => {
  const report = shapeGrowthReport(
    [],
    [{ user_id: "new-host", account_created_at: "2026-10-09T10:00:00.000Z", channel: "direct" }],
    NOW,
  );

  assert.deepEqual(report.ownerActivations, {
    eventPublished: { numerator: 0, denominator: 1, rate: 0 },
    firstRsvpReceived: { numerator: 0, denominator: 1, rate: 0 },
  });
  assert.deepEqual(report.sevenDayMatureCohort.eventPublished, { numerator: 0, denominator: 0, rate: null });
  assert.deepEqual(report.sevenDayMatureCohort.firstRsvpReceived, { numerator: 0, denominator: 0, rate: null });
  assert.deepEqual(report.sevenDayMatureCohort.byChannel.direct.eventPublished, { numerator: 0, denominator: 0, rate: null });
});

test("scopes SQL to the bounded window, current hosts, and post-signup milestones", async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  await buildGrowthReport({
    now: NOW,
    execute: async (sql, params) => {
      calls.push({ sql, params });
      return sql.includes("marketing_pageviews")
        ? [{ day: "2026-10-10", channel: "direct", views: "1" }]
        : [{ user_id: "host-a", account_created_at: "2026-10-01T10:00:00.000Z", channel: "direct" }];
    },
  });

  assert.equal(calls.length, 2);
  const pageviewCall = calls.find((call) => call.sql.includes("marketing_pageviews"));
  const signupCall = calls.find((call) => call.sql.includes("activation_events"));
  assert.ok(pageviewCall);
  assert.ok(signupCall);
  assert.match(pageviewCall.sql, /day >= \$1::date/);
  assert.match(pageviewCall.sql, /day <= \$2::date/);
  assert.match(signupCall.sql, /JOIN admin_users/);
  assert.match(signupCall.sql, /ae\.user_id IS NOT NULL/);
  assert.match(signupCall.sql, /ae\.created_at >= \$1::timestamptz/);
  assert.match(signupCall.sql, /ae\.created_at <= \$2::timestamptz/);
  assert.match(signupCall.sql, /ae\.created_at >= accounts\.account_created_at/);
  assert.match(signupCall.sql, /ae\.created_at <= \$2::timestamptz/);
  assert.doesNotMatch(signupCall.sql, /COUNT\s*\(.*event/i);
  assert.deepEqual(pageviewCall.params, ["2026-09-11", "2026-10-10"]);
  assert.deepEqual(signupCall.params, ["2026-09-11T00:00:00.000Z", "2026-10-10T12:00:00.000Z"]);
});

test("keeps the query text available for endpoint-level scoping tests", () => {
  assert.match(growthReportSql.pageviews, /marketing_pageviews/);
  assert.match(growthReportSql.signups, /activation_events/);
  assert.match(growthReportSql.signups, /admin_users/);
});
