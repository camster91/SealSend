import assert from "node:assert/strict";
import test from "node:test";

import { buildBetaParticipantReport } from "../src/lib/beta-participant-report";

test("per-host beta report includes only pseudonymous acceptance evidence after consent", () => {
  const report = buildBetaParticipantReport({
    participantLabel: "host-abcdef123456",
    segment: "repeat_planner",
    consentVersion: "beta-observation-recurring-community-2026-08-27",
    consentedAt: "2026-08-27T12:00:00.000Z",
    withdrawnAt: null,
    activationEvents: [
      { name: "event_published", createdAt: "2026-08-27T11:59:59.000Z" },
      { name: "event_published", createdAt: "2026-08-27T12:01:00.000Z" },
      { name: "event_repeated", createdAt: "2026-08-27T12:02:00.000Z" },
    ],
    feedbackEntries: [
      { createdAt: "2026-08-27T11:00:00.000Z" },
      { createdAt: "2026-08-27T12:03:00.000Z" },
    ],
  });

  assert.equal(report.participantLabel, "host-abcdef123456");
  assert.equal(report.segment, "repeat_planner");
  assert.equal(report.active, true);
  assert.equal(report.progress.steps.eventAndDesign, true);
  assert.equal(report.progress.steps.repeatEvent, true);
  assert.equal(report.progress.steps.feedback, true);
  assert.equal(report.feedbackCount, 1);
  assert.equal(report.criticalDefects, null);
  assert.equal("userId" in report, false);
  assert.equal("email" in report, false);
  assert.equal("feedbackMessages" in report, false);
});

test("withdrawn beta host remains visible without being reported as active", () => {
  const report = buildBetaParticipantReport({
    participantLabel: "host-fedcba654321",
    segment: "creative_community",
    consentVersion: "beta-observation-recurring-community-2026-08-27",
    consentedAt: "2026-08-27T12:00:00.000Z",
    withdrawnAt: "2026-08-27T13:00:00.000Z",
    activationEvents: [],
    feedbackEntries: [],
  });

  assert.equal(report.active, false);
  assert.equal(report.withdrawnAt, "2026-08-27T13:00:00.000Z");
  assert.equal(report.progress.allRequiredComplete, false);
  assert.equal(report.feedbackCount, 0);
  assert.equal(report.criticalDefects, null);
});
