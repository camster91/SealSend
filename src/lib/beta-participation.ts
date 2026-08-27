import { z } from "zod";

export const BETA_CONSENT_VERSION = "beta-observation-recurring-community-2026-08-27";

export const BETA_SEGMENTS = [
  "club_association",
  "volunteer_nonprofit",
  "creative_community",
  "alumni_professional",
  "repeat_planner",
] as const;

export type BetaSegment = (typeof BETA_SEGMENTS)[number];

const betaEnrollmentSchema = z.object({
  segment: z.enum(BETA_SEGMENTS),
  consent: z.literal(true),
}).strict();

export function parseBetaEnrollment(input: unknown): {
  segment: BetaSegment;
  consentVersion: string;
} {
  const enrollment = betaEnrollmentSchema.parse(input);
  return {
    segment: enrollment.segment,
    consentVersion: BETA_CONSENT_VERSION,
  };
}

export function isBetaParticipationActive(participation: {
  consentedAt: string;
  withdrawnAt: string | null;
}): boolean {
  return Boolean(participation.consentedAt) && !participation.withdrawnAt;
}

export const BETA_MILESTONE_NAMES = [
  "event_published",
  "guest_import_completed",
  "first_invitation_sent",
  "first_rsvp_received",
  "announcement_approved",
  "calendar_exported",
  "first_guest_checked_in",
  "account_exported",
  "event_repeated",
] as const;

export type BetaMilestoneName = (typeof BETA_MILESTONE_NAMES)[number];

interface BetaMilestone {
  name: BetaMilestoneName;
  createdAt: string;
}

const REQUIRED_STEP_KEYS = [
  "account",
  "eventAndDesign",
  "guestImport",
  "controlledInvite",
  "rsvp",
  "announcementReview",
  "calendar",
  "checkIn",
  "export",
  "feedback",
] as const;

export function deriveBetaProgress(input: {
  consentedAt: string;
  activationEvents: BetaMilestone[];
  feedbackCount: number;
}) {
  const consentedAt = new Date(input.consentedAt).getTime();
  const milestones = new Set(
    input.activationEvents
      .filter((event) => new Date(event.createdAt).getTime() >= consentedAt)
      .map((event) => event.name),
  );
  const steps = {
    account: true,
    eventAndDesign: milestones.has("event_published"),
    guestImport: milestones.has("guest_import_completed"),
    controlledInvite: milestones.has("first_invitation_sent"),
    rsvp: milestones.has("first_rsvp_received"),
    announcementReview: milestones.has("announcement_approved"),
    calendar: milestones.has("calendar_exported"),
    checkIn: milestones.has("first_guest_checked_in"),
    export: milestones.has("account_exported"),
    feedback: input.feedbackCount > 0,
    repeatEvent: milestones.has("event_repeated"),
  };
  const completedRequired = REQUIRED_STEP_KEYS.filter((key) => steps[key]).length;
  return {
    steps,
    completedRequired,
    requiredTotal: REQUIRED_STEP_KEYS.length,
    allRequiredComplete: completedRequired === REQUIRED_STEP_KEYS.length,
  };
}
