import assert from "node:assert/strict";
import test from "node:test";

import {
  BETA_SUPPORT_REVIEW_CONFIRMATION,
  BETA_SUPPORT_REVIEW_VERSION,
  parseBetaSupportReview,
} from "../src/lib/beta-support-review";

test("operator support review accepts named, bounded minutes with explicit confirmation", () => {
  assert.deepEqual(parseBetaSupportReview({
    participantLabel: "host-abcdef123456",
    reviewerName: "Cameron Ashley",
    operatorRecordedSupportMinutes: 0,
    confirmation: BETA_SUPPORT_REVIEW_CONFIRMATION,
  }), {
    participantLabel: "host-abcdef123456",
    reviewerName: "Cameron Ashley",
    operatorRecordedSupportMinutes: 0,
    reviewVersion: BETA_SUPPORT_REVIEW_VERSION,
  });
});

test("operator support review rejects defaults, anonymous reviewers, invalid minutes, and free text", () => {
  const valid = {
    participantLabel: "host-abcdef123456",
    reviewerName: "Cameron Ashley",
    operatorRecordedSupportMinutes: 35,
    confirmation: BETA_SUPPORT_REVIEW_CONFIRMATION,
  };
  assert.throws(() => parseBetaSupportReview({ ...valid, confirmation: "yes" }));
  assert.throws(() => parseBetaSupportReview({ ...valid, reviewerName: " " }));
  assert.throws(() => parseBetaSupportReview({ ...valid, operatorRecordedSupportMinutes: -1 }));
  assert.throws(() => parseBetaSupportReview({ ...valid, operatorRecordedSupportMinutes: 1.5 }));
  assert.throws(() => parseBetaSupportReview({ ...valid, operatorRecordedSupportMinutes: 601 }));
  assert.throws(() => parseBetaSupportReview({ ...valid, participantLabel: "person@example.com" }));
  assert.throws(() => parseBetaSupportReview({ ...valid, notes: "support details must not be accepted" }));
});
