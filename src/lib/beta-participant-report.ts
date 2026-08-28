import {
  deriveBetaProgress,
  type BetaMilestoneName,
  type BetaSegment,
} from "./beta-participation";
import type { BetaWillingnessToPay } from "./beta-outcome";

interface BetaParticipantReportInput {
  participantLabel: string;
  segment: BetaSegment;
  consentVersion: string;
  consentedAt: string;
  withdrawnAt: string | null;
  activationEvents: Array<{ name: BetaMilestoneName; createdAt: string }>;
  feedbackEntries: Array<{ createdAt: string }>;
  outcome: null | {
    willingnessToPay: BetaWillingnessToPay;
    repeatIntent: number;
    selfReportedSupportMinutes: number;
    priceVersion: string;
    submittedAt: string;
  };
  defectReview: null | {
    unresolvedSeverity1: number;
    unresolvedSeverity2: number;
    reviewVersion: string;
    reviewedAt: string;
  };
  supportReview: null | {
    operatorRecordedSupportMinutes: number;
    reviewVersion: string;
    reviewedAt: string;
  };
}

export function buildBetaParticipantReport(input: BetaParticipantReportInput) {
  const consentedAt = new Date(input.consentedAt).getTime();
  const feedbackCount = input.feedbackEntries.filter(
    (entry) => new Date(entry.createdAt).getTime() >= consentedAt,
  ).length;
  const progress = deriveBetaProgress({
    consentedAt: input.consentedAt,
    activationEvents: input.activationEvents,
    feedbackCount,
  });

  return {
    participantLabel: input.participantLabel,
    segment: input.segment,
    consentVersion: input.consentVersion,
    consentedAt: input.consentedAt,
    withdrawnAt: input.withdrawnAt,
    active: input.withdrawnAt === null,
    progress,
    feedbackCount,
    outcome: input.outcome,
    criticalDefects: input.defectReview
      ? input.defectReview.unresolvedSeverity1 + input.defectReview.unresolvedSeverity2
      : null,
    criticalDefectReview: input.defectReview,
    operatorSupportReview: input.supportReview,
  };
}
