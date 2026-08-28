import {
  deriveBetaProgress,
  type BetaMilestoneName,
  type BetaSegment,
} from "@/lib/beta-participation";
import type { BetaWillingnessToPay } from "@/lib/beta-outcome";

export interface BetaCohortParticipant {
  participantId: string;
  segment: BetaSegment;
  consentedAt: string;
  withdrawnAt: string | null;
  activationEvents: Array<{ name: BetaMilestoneName; createdAt: string }>;
  feedbackRatings: number[];
  outcome: null | {
    willingnessToPay: BetaWillingnessToPay;
    repeatIntent: number;
    selfReportedSupportMinutes: number;
  };
}

interface RateMetric {
  numerator: number;
  denominator: number;
  rate: number | null;
}

function rate(numerator: number, denominator: number): RateMetric {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  return Math.round(value * 100) / 100;
}

export function computeBetaCohortMetrics(participants: BetaCohortParticipant[]) {
  const active = participants.filter((participant) => !participant.withdrawnAt);
  const progress = active.map((participant) => ({
    segment: participant.segment,
    consentedAt: participant.consentedAt,
    events: participant.activationEvents.filter(
      (event) => new Date(event.createdAt).getTime() >= new Date(participant.consentedAt).getTime(),
    ),
    feedbackRatings: participant.feedbackRatings.filter((rating) => rating >= 1 && rating <= 5),
    outcome: participant.outcome,
  })).map((participant) => ({
    ...participant,
    progress: deriveBetaProgress({
      consentedAt: participant.consentedAt,
      activationEvents: participant.events,
      feedbackCount: participant.feedbackRatings.length,
    }),
  }));

  const completed = progress.filter((participant) => participant.progress.allRequiredComplete).length;
  const published = progress.filter((participant) => participant.progress.steps.eventAndDesign).length;
  const imported = progress.filter((participant) => participant.progress.steps.guestImport).length;
  const invited = progress.filter((participant) => participant.progress.steps.controlledInvite).length;
  const rsvped = progress.filter((participant) => participant.progress.steps.rsvp).length;
  const reviewedAnnouncement = progress.filter((participant) => participant.progress.steps.announcementReview).length;
  const downloadedCalendar = progress.filter((participant) => participant.progress.steps.calendar).length;
  const checkedIn = progress.filter((participant) => participant.progress.steps.checkIn).length;
  const exported = progress.filter((participant) => participant.progress.steps.export).length;
  const suppliedFeedback = progress.filter((participant) => participant.progress.steps.feedback).length;
  const repeatPlanners = progress.filter((participant) => participant.segment === "repeat_planner");
  const repeaters = repeatPlanners.filter((participant) => participant.progress.steps.repeatEvent).length;
  const publishHours = progress.flatMap((participant) => {
    const firstPublishedAt = participant.events
      .filter((event) => event.name === "event_published")
      .map((event) => new Date(event.createdAt).getTime())
      .sort((a, b) => a - b)[0];
    if (!firstPublishedAt) return [];
    return [(firstPublishedAt - new Date(participant.consentedAt).getTime()) / 3_600_000];
  });
  const ratings = progress.flatMap((participant) => participant.feedbackRatings);
  const denominator = active.length;
  const outcomes = progress.flatMap((participant) => participant.outcome ? [participant.outcome] : []);

  return {
    cohortSize: denominator,
    segmentsRepresented: [...new Set(active.map((participant) => participant.segment))].sort(),
    workflowCompletion: rate(completed, denominator),
    eventPublish: rate(published, denominator),
    guestImport: rate(imported, denominator),
    controlledInvite: rate(invited, denominator),
    rsvp: rate(rsvped, denominator),
    announcementReview: rate(reviewedAnnouncement, denominator),
    calendar: rate(downloadedCalendar, denominator),
    checkIn: rate(checkedIn, denominator),
    export: rate(exported, denominator),
    feedback: rate(suppliedFeedback, denominator),
    repeatUse: rate(repeaters, repeatPlanners.length),
    medianHoursToFirstPublish: median(publishHours),
    averageFeedbackRating: ratings.length === 0
      ? null
      : Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 100) / 100,
    statedWillingnessToPay: {
      annualPro: outcomes.filter((outcome) => outcome.willingnessToPay === "annual_pro").length,
      perEvent: outcomes.filter((outcome) => outcome.willingnessToPay === "per_event").length,
      freeOnly: outcomes.filter((outcome) => outcome.willingnessToPay === "free_only").length,
      unsure: outcomes.filter((outcome) => outcome.willingnessToPay === "unsure").length,
      responses: outcomes.length,
      denominator,
    },
    medianSelfReportedSupportMinutes: median(outcomes.map((outcome) => outcome.selfReportedSupportMinutes)),
  };
}
