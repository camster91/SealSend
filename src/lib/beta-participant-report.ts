import {
  deriveBetaProgress,
  type BetaMilestoneName,
  type BetaSegment,
} from "./beta-participation";

interface BetaParticipantReportInput {
  participantLabel: string;
  segment: BetaSegment;
  consentVersion: string;
  consentedAt: string;
  withdrawnAt: string | null;
  activationEvents: Array<{ name: BetaMilestoneName; createdAt: string }>;
  feedbackEntries: Array<{ createdAt: string }>;
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
    criticalDefects: null,
  };
}
