import assert from "node:assert/strict";
import test from "node:test";

import { computeBetaCohortMetrics } from "../src/lib/beta-metrics";

test("empty beta cohorts report null rates instead of implying zero-percent performance", () => {
  const metrics = computeBetaCohortMetrics([]);
  assert.equal(metrics.cohortSize, 0);
  assert.deepEqual(metrics.workflowCompletion, { numerator: 0, denominator: 0, rate: null });
  assert.deepEqual(metrics.repeatUse, { numerator: 0, denominator: 0, rate: null });
  assert.equal(metrics.medianHoursToFirstPublish, null);
  assert.equal(metrics.averageFeedbackRating, null);
});

test("cohort metrics exclude withdrawn hosts and milestones recorded before consent", () => {
  const metrics = computeBetaCohortMetrics([
    {
      participantId: "internal-host-a",
      segment: "repeat_planner",
      consentedAt: "2026-08-27T12:00:00.000Z",
      withdrawnAt: null,
      activationEvents: [
        { name: "event_published", createdAt: "2026-08-27T11:00:00.000Z" },
        { name: "event_published", createdAt: "2026-08-27T14:00:00.000Z" },
        { name: "guest_import_completed", createdAt: "2026-08-27T14:05:00.000Z" },
        { name: "first_invitation_sent", createdAt: "2026-08-27T14:10:00.000Z" },
        { name: "first_rsvp_received", createdAt: "2026-08-27T14:15:00.000Z" },
        { name: "announcement_approved", createdAt: "2026-08-27T14:20:00.000Z" },
        { name: "calendar_exported", createdAt: "2026-08-27T14:25:00.000Z" },
        { name: "first_guest_checked_in", createdAt: "2026-08-27T14:30:00.000Z" },
        { name: "account_exported", createdAt: "2026-08-27T14:35:00.000Z" },
        { name: "event_repeated", createdAt: "2026-08-27T14:40:00.000Z" },
      ],
      feedbackRatings: [4, 5],
    },
    {
      participantId: "withdrawn-host",
      segment: "wedding",
      consentedAt: "2026-08-27T12:00:00.000Z",
      withdrawnAt: "2026-08-27T13:00:00.000Z",
      activationEvents: [{ name: "event_published", createdAt: "2026-08-27T12:10:00.000Z" }],
      feedbackRatings: [1],
    },
  ]);

  assert.equal(metrics.cohortSize, 1);
  assert.deepEqual(metrics.segmentsRepresented, ["repeat_planner"]);
  assert.deepEqual(metrics.eventPublish, { numerator: 1, denominator: 1, rate: 1 });
  assert.deepEqual(metrics.workflowCompletion, { numerator: 1, denominator: 1, rate: 1 });
  assert.deepEqual(metrics.repeatUse, { numerator: 1, denominator: 1, rate: 1 });
  assert.equal(metrics.medianHoursToFirstPublish, 2);
  assert.equal(metrics.averageFeedbackRating, 4.5);
  assert.doesNotMatch(JSON.stringify(metrics), /internal-host-a|withdrawn-host/);
});

test("repeat-use rate uses repeat planners rather than the whole cohort as its denominator", () => {
  const metrics = computeBetaCohortMetrics([
    {
      participantId: "repeat-a",
      segment: "repeat_planner",
      consentedAt: "2026-08-27T12:00:00.000Z",
      withdrawnAt: null,
      activationEvents: [],
      feedbackRatings: [],
    },
    {
      participantId: "community-a",
      segment: "community_nonprofit",
      consentedAt: "2026-08-27T12:00:00.000Z",
      withdrawnAt: null,
      activationEvents: [{ name: "event_repeated", createdAt: "2026-08-27T13:00:00.000Z" }],
      feedbackRatings: [],
    },
  ]);

  assert.deepEqual(metrics.repeatUse, { numerator: 0, denominator: 1, rate: 0 });
});
