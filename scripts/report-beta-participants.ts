#!/usr/bin/env tsx

import { Pool } from "pg";

import { buildBetaParticipantReport } from "../src/lib/beta-participant-report";
import {
  BETA_MILESTONE_NAMES,
  BETA_SEGMENTS,
  type BetaMilestoneName,
  type BetaSegment,
} from "../src/lib/beta-participation";
import type { BetaWillingnessToPay } from "../src/lib/beta-outcome";
import betaAcceptancePolicy from "../config/beta-acceptance-policy.json";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Error: Missing DATABASE_URL environment variable");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

interface ParticipantRow {
  participant_label: string;
  cohort_version: string;
  segment: BetaSegment;
  consent_version: string;
  consented_at: string;
  withdrawn_at: string | null;
}

interface MilestoneRow {
  participant_label: string;
  event_name: BetaMilestoneName;
  created_at: string;
}

interface FeedbackRow {
  participant_label: string;
  created_at: string;
}

interface OutcomeRow {
  participant_label: string;
  willingness_to_pay: BetaWillingnessToPay;
  repeat_intent: number;
  self_reported_support_minutes: number;
  price_version: string;
  updated_at: string;
}

interface DefectReviewRow {
  participant_label: string;
  unresolved_severity_1: number;
  unresolved_severity_2: number;
  review_version: string;
  reviewed_at: string;
}

interface SupportReviewRow {
  participant_label: string;
  operator_recorded_support_minutes: number;
  review_version: string;
  reviewed_at: string;
}

async function reportBetaParticipants() {
  try {
    const [participants, milestones, feedbackEntries, outcomes, defectReviews, supportReviews] = await Promise.all([
      pool.query<ParticipantRow>(
        `SELECT participant_label,
                cohort_version,
                segment,
                consent_version,
                consented_at::text,
                withdrawn_at::text
           FROM beta_participants
          WHERE cohort_version = $1
            AND segment = ANY($2::text[])
          ORDER BY consented_at ASC, participant_label ASC`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS],
      ),
      pool.query<MilestoneRow>(
        `SELECT participants.participant_label,
                milestones.event_name,
                milestones.created_at::text
           FROM beta_participants participants
           JOIN activation_events milestones
             ON milestones.user_id = participants.user_id
            AND milestones.created_at >= participants.consented_at
          WHERE participants.cohort_version = $1
            AND participants.segment = ANY($2::text[])
            AND milestones.event_name = ANY($3::text[])
          ORDER BY participants.participant_label, milestones.created_at`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS, BETA_MILESTONE_NAMES],
      ),
      pool.query<FeedbackRow>(
        `SELECT participants.participant_label,
                feedback.created_at::text
           FROM beta_participants participants
           JOIN beta_feedback feedback
             ON feedback.user_id = participants.user_id
            AND feedback.created_at >= participants.consented_at
          WHERE participants.cohort_version = $1
            AND participants.segment = ANY($2::text[])
          ORDER BY participants.participant_label, feedback.created_at`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS],
      ),
      pool.query<OutcomeRow>(
        `SELECT participants.participant_label,
                outcomes.willingness_to_pay,
                outcomes.repeat_intent,
                outcomes.self_reported_support_minutes,
                outcomes.price_version,
                outcomes.updated_at::text
           FROM beta_participants participants
           JOIN beta_outcomes outcomes
             ON outcomes.user_id = participants.user_id
            AND outcomes.consented_at = participants.consented_at
          WHERE participants.cohort_version = $1
            AND participants.segment = ANY($2::text[])
          ORDER BY participants.participant_label`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS],
      ),
      pool.query<DefectReviewRow>(
        `SELECT participants.participant_label,
                reviews.unresolved_severity_1,
                reviews.unresolved_severity_2,
                reviews.review_version,
                reviews.reviewed_at::text
           FROM beta_participants participants
           JOIN beta_defect_reviews reviews
             ON reviews.user_id = participants.user_id
            AND reviews.consented_at = participants.consented_at
          WHERE participants.cohort_version = $1
            AND participants.segment = ANY($2::text[])
          ORDER BY participants.participant_label`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS],
      ),
      pool.query<SupportReviewRow>(
        `SELECT participants.participant_label,
                reviews.operator_recorded_support_minutes,
                reviews.review_version,
                reviews.reviewed_at::text
           FROM beta_participants participants
           JOIN beta_support_reviews reviews
             ON reviews.user_id = participants.user_id
            AND reviews.consented_at = participants.consented_at
          WHERE participants.cohort_version = $1
            AND participants.segment = ANY($2::text[])
          ORDER BY participants.participant_label`,
        [betaAcceptancePolicy.cohortVersion, BETA_SEGMENTS],
      ),
    ]);

    if (participants.rows.length === 0) {
      console.log("No beta participants found.");
      return;
    }

    for (const participant of participants.rows) {
      const report = buildBetaParticipantReport({
        participantLabel: participant.participant_label,
        cohortVersion: participant.cohort_version,
        segment: participant.segment,
        consentVersion: participant.consent_version,
        consentedAt: participant.consented_at,
        withdrawnAt: participant.withdrawn_at,
        activationEvents: milestones.rows
          .filter((milestone) => milestone.participant_label === participant.participant_label)
          .map((milestone) => ({ name: milestone.event_name, createdAt: milestone.created_at })),
        feedbackEntries: feedbackEntries.rows
          .filter((entry) => entry.participant_label === participant.participant_label)
          .map((entry) => ({ createdAt: entry.created_at })),
        outcome: (() => {
          const outcome = outcomes.rows.find((entry) => entry.participant_label === participant.participant_label);
          return outcome ? {
            willingnessToPay: outcome.willingness_to_pay,
            repeatIntent: outcome.repeat_intent,
            selfReportedSupportMinutes: outcome.self_reported_support_minutes,
            priceVersion: outcome.price_version,
            submittedAt: outcome.updated_at,
          } : null;
        })(),
        defectReview: (() => {
          const review = defectReviews.rows.find((entry) => entry.participant_label === participant.participant_label);
          return review ? {
            unresolvedSeverity1: review.unresolved_severity_1,
            unresolvedSeverity2: review.unresolved_severity_2,
            reviewVersion: review.review_version,
            reviewedAt: review.reviewed_at,
          } : null;
        })(),
        supportReview: (() => {
          const review = supportReviews.rows.find((entry) => entry.participant_label === participant.participant_label);
          return review ? {
            operatorRecordedSupportMinutes: review.operator_recorded_support_minutes,
            reviewVersion: review.review_version,
            reviewedAt: review.reviewed_at,
          } : null;
        })(),
      });
      console.log(JSON.stringify(report));
    }
  } catch (error) {
    console.error("Error reporting beta participants:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void reportBetaParticipants();
