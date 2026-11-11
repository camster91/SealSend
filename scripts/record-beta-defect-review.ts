#!/usr/bin/env tsx

import {
  BETA_DEFECT_REVIEW_CONFIRMATION,
  parseBetaDefectReview,
} from "../src/lib/beta-defect-review";
import { BETA_SEGMENTS } from "../src/lib/beta-participation";
import { query } from "../src/lib/db/client";
import { DATABASE_TARGET_HELP, isoText, requireCliDatabase } from "./lib/cli-database";

requireCliDatabase();

let review: ReturnType<typeof parseBetaDefectReview>;
try {
  review = parseBetaDefectReview({
    participantLabel: process.argv[2],
    reviewerName: process.argv[3],
    unresolvedSeverity1: Number(process.argv[4]),
    unresolvedSeverity2: Number(process.argv[5]),
    confirmation: process.argv[6],
  });
} catch {
  console.error(
    `Usage: npm run record-beta-defect-review -- <host-xxxxxxxxxxxx> <reviewer-name> <severity-1-count> <severity-2-count> ${BETA_DEFECT_REVIEW_CONFIRMATION}`,
  );
  console.error(DATABASE_TARGET_HELP);
  process.exit(1);
}

async function recordBetaDefectReview() {
  try {
    // One statement replaces the old lock-then-upsert transaction: the participant lookup and
    // the upsert run atomically, and no row back means no current-scope participant.
    const [result] = await query<{ reviewed_at: Date }>(
      `INSERT INTO beta_defect_reviews
         (user_id, consented_at, reviewer_name, review_version,
          unresolved_severity_1, unresolved_severity_2, reviewed_at, updated_at)
       SELECT user_id, consented_at, $3, $4, $5, $6,
              strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         FROM beta_participants
        WHERE participant_label = $1
          AND segment IN (SELECT value FROM json_each($2))
       ON CONFLICT (user_id, consented_at) DO UPDATE SET
         reviewer_name = excluded.reviewer_name,
         review_version = excluded.review_version,
         unresolved_severity_1 = excluded.unresolved_severity_1,
         unresolved_severity_2 = excluded.unresolved_severity_2,
         reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       RETURNING reviewed_at`,
      [
        review.participantLabel,
        BETA_SEGMENTS,
        review.reviewerName,
        review.reviewVersion,
        review.unresolvedSeverity1,
        review.unresolvedSeverity2,
      ],
    );
    if (!result) throw new Error("Current-scope beta participant not found.");
    console.log(
      `${review.participantLabel} | severity-1=${review.unresolvedSeverity1} | severity-2=${review.unresolvedSeverity2} | critical=${review.criticalDefects} | status=reviewed | reviewed=${isoText(result.reviewed_at)}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to record beta defect review");
    process.exitCode = 1;
  }
}

void recordBetaDefectReview();
