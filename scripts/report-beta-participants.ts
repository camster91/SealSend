#!/usr/bin/env tsx

import { buildBetaParticipantReport } from "../src/lib/beta-participant-report";
import {
  BETA_MILESTONE_NAMES,
  BETA_SEGMENTS,
  type BetaMilestoneName,
  type BetaSegment,
} from "../src/lib/beta-participation";
import type { BetaWillingnessToPay } from "../src/lib/beta-outcome";
import { query } from "../src/lib/db/client";
import betaAcceptancePolicy from "../config/beta-acceptance-policy.json";
import { isoText, requireCliDatabase } from "./lib/cli-database";

requireCliDatabase();

interface ParticipantRow {
  participant_label: string;
  cohort_version: string;
  segment: BetaSegment;
  consent_version: string;
  consented_at: Date;
  withdrawn_at: Date | null;
}

interface MilestoneRow {
  participant_label: string;
  event_name: BetaMilestoneName;
  created_at: Date;
}

interface FeedbackRow {
  participant_label: string;
  created_at: Date;
}

interface OutcomeRow {
  participant_label: string;
  willingness_to_pay: BetaWillingnessToPay;
  repeat_intent: number;
  self_reported_support_minutes: number;
  price_version: string;
  updated_at: Date;
}

interface DefectReviewRow {
  participant_label: string;
  unresolved_severity_1: number;
  unresolved_severity_2: number;
  review_version: string;
  reviewed_at: Date;
}

interface SupportReviewRow {
  participant_label: string;
  operator_recorded_support_minutes: number;
  review_version: string;
  reviewed_at: Date;
}

async function reportBetaParticipants() {
  try {
    const [participants, milestones, feedbackEntries, outcomes, defectReviews, supportReviews] = await Promise.all([
      query<ParticipantRow>(
        `SELECT participant_label,
                cohort_version,
                segment,
                consent_version,
                consented_at,
                withdrawn_at
           FROM beta_participants
          WHERE cohort_version = $1
            AND segment IN (SELECT value FROM json_each($2))
          ORDER BY consented_at ASC, participant_label ASC`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS],
      ),
      query<MilestoneRow>(
        `SELECT participants.participant_label,
                milestones.event_name,
                milestones.created_at
           FROM beta_participants participants
           JOIN activation_events milestones
             ON milestones.user_id = participants.user_id
            AND milestones.created_at >= participants.consented_at
          WHERE participants.cohort_version = $1
            AND participants.segment IN (SELECT value FROM json_each($2))
            AND milestones.event_name IN (SELECT value FROM json_each($3))
          ORDER BY participants.participant_label, milestones.created_at`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS, BETA_MILESTONE_NAMES],
      ),
      query<FeedbackRow>(
        `SELECT participants.participant_label,
                feedback.created_at
           FROM beta_participants participants
           JOIN beta_feedback feedback
             ON feedback.user_id = participants.user_id
            AND feedback.created_at >= participants.consented_at
          WHERE participants.cohort_version = $1
            AND participants.segment IN (SELECT value FROM json_each($2))
          ORDER BY participants.participant_label, feedback.created_at`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS],
      ),
      query<OutcomeRow>(
        `SELECT participants.participant_label,
                outcomes.willingness_to_pay,
                outcomes.repeat_intent,
                outcomes.self_reported_support_minutes,
                outcomes.price_version,
                outcomes.updated_at
           FROM beta_participants participants
           JOIN beta_outcomes outcomes
             ON outcomes.user_id = participants.user_id
            AND outcomes.consented_at = participants.consented_at
          WHERE participants.cohort_version = $1
            AND participants.segment IN (SELECT value FROM json_each($2))
          ORDER BY participants.participant_label`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS],
      ),
      query<DefectReviewRow>(
        `SELECT participants.participant_label,
                reviews.unresolved_severity_1,
                reviews.unresolved_severity_2,
                reviews.review_version,
                reviews.reviewed_at
           FROM beta_participants participants
           JOIN beta_defect_reviews reviews
             ON reviews.user_id = participants.user_id
            AND reviews.consented_at = participants.consented_at
          WHERE participants.cohort_version = $1
            AND participants.segment IN (SELECT value FROM json_each($2))
          ORDER BY participants.participant_label`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS],
      ),
      query<SupportReviewRow>(
        `SELECT participants.participant_label,
                reviews.operator_recorded_support_minutes,
                reviews.review_version,
                reviews.reviewed_at
           FROM beta_participants participants
           JOIN beta_support_reviews reviews
             ON reviews.user_id = participants.user_id
            AND reviews.consented_at = participants.consented_at
          WHERE participants.cohort_version = $1
            AND participants.segment IN (SELECT value FROM json_each($2))
          ORDER BY participants.participant_label`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS],
      ),
    ]);

    if (participants.length === 0) {
      console.log("No beta participants found.");
      return;
    }

    for (const participant of participants) {
      const report = buildBetaParticipantReport({
        participantLabel: participant.participant_label,
        cohortVersion: participant.cohort_version,
        segment: participant.segment,
        consentVersion: participant.consent_version,
        consentedAt: isoText(participant.consented_at),
        withdrawnAt: isoText(participant.withdrawn_at),
        activationEvents: milestones
          .filter((milestone) => milestone.participant_label === participant.participant_label)
          .map((milestone) => ({ name: milestone.event_name, createdAt: isoText(milestone.created_at) })),
        feedbackEntries: feedbackEntries
          .filter((entry) => entry.participant_label === participant.participant_label)
          .map((entry) => ({ createdAt: isoText(entry.created_at) })),
        outcome: (() => {
          const outcome = outcomes.find((entry) => entry.participant_label === participant.participant_label);
          return outcome ? {
            willingnessToPay: outcome.willingness_to_pay,
            repeatIntent: outcome.repeat_intent,
            selfReportedSupportMinutes: outcome.self_reported_support_minutes,
            priceVersion: outcome.price_version,
            submittedAt: isoText(outcome.updated_at),
          } : null;
        })(),
        defectReview: (() => {
          const review = defectReviews.find((entry) => entry.participant_label === participant.participant_label);
          return review ? {
            unresolvedSeverity1: review.unresolved_severity_1,
            unresolvedSeverity2: review.unresolved_severity_2,
            reviewVersion: review.review_version,
            reviewedAt: isoText(review.reviewed_at),
          } : null;
        })(),
        supportReview: (() => {
          const review = supportReviews.find((entry) => entry.participant_label === participant.participant_label);
          return review ? {
            operatorRecordedSupportMinutes: review.operator_recorded_support_minutes,
            reviewVersion: review.review_version,
            reviewedAt: isoText(review.reviewed_at),
          } : null;
        })(),
      });
      console.log(JSON.stringify(report));
    }
  } catch (error) {
    console.error("Error reporting beta participants:", error);
    process.exitCode = 1;
  }
}

void reportBetaParticipants();
