import assert from "node:assert/strict";
import test from "node:test";

import {
  BETA_DEFECT_REVIEW_CONFIRMATION,
  BETA_DEFECT_REVIEW_VERSION,
  parseBetaDefectReview,
} from "../src/lib/beta-defect-review";

test("human defect review accepts named, bounded severity counts with explicit confirmation", () => {
  assert.deepEqual(parseBetaDefectReview({
    participantLabel: "host-abcdef123456",
    reviewerName: "Cameron Ashley",
    unresolvedSeverity1: 0,
    unresolvedSeverity2: 2,
    confirmation: BETA_DEFECT_REVIEW_CONFIRMATION,
  }), {
    participantLabel: "host-abcdef123456",
    reviewerName: "Cameron Ashley",
    unresolvedSeverity1: 0,
    unresolvedSeverity2: 2,
    criticalDefects: 2,
    reviewVersion: BETA_DEFECT_REVIEW_VERSION,
  });
});

test("human defect review rejects defaults, anonymous reviewers, and invalid counts", () => {
  const valid = {
    participantLabel: "host-abcdef123456",
    reviewerName: "Cameron Ashley",
    unresolvedSeverity1: 0,
    unresolvedSeverity2: 0,
    confirmation: BETA_DEFECT_REVIEW_CONFIRMATION,
  };
  assert.throws(() => parseBetaDefectReview({ ...valid, confirmation: "yes" }));
  assert.throws(() => parseBetaDefectReview({ ...valid, reviewerName: " " }));
  assert.throws(() => parseBetaDefectReview({ ...valid, unresolvedSeverity1: -1 }));
  assert.throws(() => parseBetaDefectReview({ ...valid, unresolvedSeverity2: 1.5 }));
  assert.throws(() => parseBetaDefectReview({ ...valid, participantLabel: "person@example.com" }));
  assert.throws(() => parseBetaDefectReview({ ...valid, notes: "guest data must not be accepted" }));
});
