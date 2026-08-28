import assert from "node:assert/strict";
import test from "node:test";

import { evaluateBetaAcceptance } from "../src/lib/beta-acceptance-decision";

const requiredSegments = [
  "club_association",
  "volunteer_nonprofit",
  "creative_community",
  "alumni_professional",
  "repeat_planner",
];

const approvedPolicy = {
  schemaVersion: 1,
  status: "approved",
  approvedBy: "Cameron Ashley",
  approvedAt: "2026-08-27T10:00:00.000Z",
  thresholds: {
    minimumCohortSize: 5,
    requiredSegments,
    minimumWorkflowCompletionRate: 0.8,
    minimumFeedbackRate: 1,
    minimumOutcomeResponseRate: 1,
    minimumSupportReviewRate: 1,
    minimumDefectReviewRate: 1,
    minimumRepeatUseRate: 1,
    minimumAverageFeedbackRating: 4,
    maximumMedianHoursToFirstPublish: 24,
    maximumMedianOperatorSupportMinutes: 60,
    maximumUnresolvedCriticalDefects: 0,
    minimumWillingToPayHosts: 3,
  },
};

const completeMetrics = {
  cohortSize: 5,
  segmentsRepresented: requiredSegments,
  workflowCompletion: { numerator: 4, denominator: 5, rate: 0.8 },
  feedback: { numerator: 5, denominator: 5, rate: 1 },
  repeatUse: { numerator: 1, denominator: 1, rate: 1 },
  medianHoursToFirstPublish: 6,
  averageFeedbackRating: 4.4,
  statedWillingnessToPay: { annualPro: 2, perEvent: 1, freeOnly: 1, unsure: 1, responses: 5, denominator: 5 },
  supportReviewCoverage: { numerator: 5, denominator: 5, rate: 1 },
  medianOperatorRecordedSupportMinutes: 20,
  defectReviewCoverage: { numerator: 5, denominator: 5, rate: 1 },
  unresolvedCriticalDefects: 0,
};

test("pending beta policy cannot produce an acceptance pass", () => {
  const result = evaluateBetaAcceptance({
    policy: { schemaVersion: 1, status: "pending", approvedBy: null, approvedAt: null, thresholds: null },
    metrics: completeMetrics,
    cohortStartedAt: null,
  });
  assert.equal(result.decision, "POLICY_NOT_APPROVED");
  assert.equal(result.passed, false);
});

test("beta policy approval must predate the first consented host", () => {
  const result = evaluateBetaAcceptance({
    policy: { ...approvedPolicy, approvedAt: "2026-08-27T12:01:00.000Z" },
    metrics: completeMetrics,
    cohortStartedAt: "2026-08-27T12:00:00.000Z",
  });
  assert.equal(result.decision, "INVALID_POLICY");
  assert.match(result.errors.join("\n"), /before the first host consent/i);
});

test("complete cohort passes every predeclared beta threshold", () => {
  const result = evaluateBetaAcceptance({
    policy: approvedPolicy,
    metrics: completeMetrics,
    cohortStartedAt: "2026-08-27T12:00:00.000Z",
  });
  assert.equal(result.decision, "BETA_ACCEPTANCE_PASS");
  assert.equal(result.passed, true);
  assert.equal(result.checks.every((check) => check.status === "pass"), true);
});

test("missing or below-threshold evidence fails without converting null to zero", () => {
  const result = evaluateBetaAcceptance({
    policy: approvedPolicy,
    metrics: {
      ...completeMetrics,
      workflowCompletion: { numerator: 3, denominator: 5, rate: 0.6 },
      medianOperatorRecordedSupportMinutes: null,
      unresolvedCriticalDefects: null,
    },
    cohortStartedAt: "2026-08-27T12:00:00.000Z",
  });
  assert.equal(result.decision, "BETA_ACCEPTANCE_FAIL");
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((check) => check.id === "workflow_completion")?.status, "fail");
  assert.equal(result.checks.find((check) => check.id === "operator_support_minutes")?.status, "missing");
  assert.equal(result.checks.find((check) => check.id === "unresolved_critical_defects")?.status, "missing");
});
