#!/usr/bin/env tsx

import { Pool } from "pg";

import { buildBetaParticipantReport } from "../src/lib/beta-participant-report";
import {
  BETA_MILESTONE_NAMES,
  BETA_SEGMENTS,
  type BetaMilestoneName,
  type BetaSegment,
} from "../src/lib/beta-participation";

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

async function reportBetaParticipants() {
  try {
    const [participants, milestones, feedbackEntries] = await Promise.all([
      pool.query<ParticipantRow>(
        `SELECT participant_label,
                segment,
                consent_version,
                consented_at::text,
                withdrawn_at::text
           FROM beta_participants
          WHERE segment = ANY($1::text[])
          ORDER BY consented_at ASC, participant_label ASC`,
        [BETA_SEGMENTS],
      ),
      pool.query<MilestoneRow>(
        `SELECT participants.participant_label,
                milestones.event_name,
                milestones.created_at::text
           FROM beta_participants participants
           JOIN activation_events milestones
             ON milestones.user_id = participants.user_id
            AND milestones.created_at >= participants.consented_at
          WHERE participants.segment = ANY($1::text[])
            AND milestones.event_name = ANY($2::text[])
          ORDER BY participants.participant_label, milestones.created_at`,
        [BETA_SEGMENTS, BETA_MILESTONE_NAMES],
      ),
      pool.query<FeedbackRow>(
        `SELECT participants.participant_label,
                feedback.created_at::text
           FROM beta_participants participants
           JOIN beta_feedback feedback
             ON feedback.user_id = participants.user_id
            AND feedback.created_at >= participants.consented_at
          WHERE participants.segment = ANY($1::text[])
          ORDER BY participants.participant_label, feedback.created_at`,
        [BETA_SEGMENTS],
      ),
    ]);

    if (participants.rows.length === 0) {
      console.log("No beta participants found.");
      return;
    }

    for (const participant of participants.rows) {
      const report = buildBetaParticipantReport({
        participantLabel: participant.participant_label,
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
