#!/usr/bin/env tsx

import {
  BETA_SUPPORT_REVIEW_CONFIRMATION,
  parseBetaSupportReview,
} from "../src/lib/beta-support-review";
import { BETA_SEGMENTS } from "../src/lib/beta-participation";
import { query } from "../src/lib/db/client";
import { DATABASE_TARGET_HELP, isoText, requireCliDatabase } from "./lib/cli-database";

requireCliDatabase();

let review: ReturnType<typeof parseBetaSupportReview>;
try {
  review = parseBetaSupportReview({
    participantLabel: process.argv[2],
    reviewerName: process.argv[3],
    operatorRecordedSupportMinutes: Number(process.argv[4]),
    confirmation: process.argv[5],
  });
} catch {
  console.error(
    `Usage: npm run record-beta-support-review -- <host-xxxxxxxxxxxx> <reviewer-name> <support-minutes> ${BETA_SUPPORT_REVIEW_CONFIRMATION}`,
  );
  console.error(DATABASE_TARGET_HELP);
  process.exit(1);
}

async function recordBetaSupportReview() {
  try {
    // One statement replaces the old lock-then-upsert transaction: the participant lookup and
    // the upsert run atomically, and no row back means no current-scope participant.
    const [result] = await query<{ reviewed_at: Date }>(
      `INSERT INTO beta_support_reviews
         (user_id, consented_at, reviewer_name, review_version,
          operator_recorded_support_minutes, reviewed_at, updated_at)
       SELECT user_id, consented_at, $3, $4, $5,
              strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         FROM beta_participants
        WHERE participant_label = $1
          AND segment IN (SELECT value FROM json_each($2))
       ON CONFLICT (user_id, consented_at) DO UPDATE SET
         reviewer_name = excluded.reviewer_name,
         review_version = excluded.review_version,
         operator_recorded_support_minutes = excluded.operator_recorded_support_minutes,
         reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       RETURNING reviewed_at`,
      [
        review.participantLabel,
        BETA_SEGMENTS,
        review.reviewerName,
        review.reviewVersion,
        review.operatorRecordedSupportMinutes,
      ],
    );
    if (!result) throw new Error("Current-scope beta participant not found.");
    console.log(
      `${review.participantLabel} | operator-support-minutes=${review.operatorRecordedSupportMinutes} | status=reviewed | reviewed=${isoText(result.reviewed_at)}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to record beta support review");
    process.exitCode = 1;
  }
}

void recordBetaSupportReview();
