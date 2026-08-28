import { z } from "zod";

import { parseBetaInviteLabel } from "./beta-invite-operations";

export const BETA_SUPPORT_REVIEW_VERSION = "beta-operator-support-review-v1";
export const BETA_SUPPORT_REVIEW_CONFIRMATION = "CONFIRM-OPERATOR-SUPPORT-REVIEW";

const betaSupportReviewSchema = z.object({
  participantLabel: z.string(),
  reviewerName: z.string().trim().min(2).max(100),
  operatorRecordedSupportMinutes: z.number().int().min(0).max(600),
  confirmation: z.literal(BETA_SUPPORT_REVIEW_CONFIRMATION),
}).strict();

export function parseBetaSupportReview(input: unknown) {
  const review = betaSupportReviewSchema.parse(input);
  return {
    participantLabel: parseBetaInviteLabel(review.participantLabel),
    reviewerName: review.reviewerName,
    operatorRecordedSupportMinutes: review.operatorRecordedSupportMinutes,
    reviewVersion: BETA_SUPPORT_REVIEW_VERSION,
  };
}
