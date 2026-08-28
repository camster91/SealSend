import { z } from "zod";

import { parseBetaInviteLabel } from "./beta-invite-operations";

export const BETA_DEFECT_REVIEW_VERSION = "beta-severity-review-v1";
export const BETA_DEFECT_REVIEW_CONFIRMATION = "CONFIRM-HUMAN-SEVERITY-TRIAGE";

const betaDefectReviewSchema = z.object({
  participantLabel: z.string(),
  reviewerName: z.string().trim().min(2).max(100),
  unresolvedSeverity1: z.number().int().min(0).max(100),
  unresolvedSeverity2: z.number().int().min(0).max(100),
  confirmation: z.literal(BETA_DEFECT_REVIEW_CONFIRMATION),
}).strict();

export function parseBetaDefectReview(input: unknown) {
  const review = betaDefectReviewSchema.parse(input);
  return {
    participantLabel: parseBetaInviteLabel(review.participantLabel),
    reviewerName: review.reviewerName,
    unresolvedSeverity1: review.unresolvedSeverity1,
    unresolvedSeverity2: review.unresolvedSeverity2,
    criticalDefects: review.unresolvedSeverity1 + review.unresolvedSeverity2,
    reviewVersion: BETA_DEFECT_REVIEW_VERSION,
  };
}
