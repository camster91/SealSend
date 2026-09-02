#!/usr/bin/env tsx

import { Pool } from "pg";

import {
  BETA_DEFECT_REVIEW_CONFIRMATION,
  parseBetaDefectReview,
} from "../src/lib/beta-defect-review";
import { BETA_SEGMENTS } from "../src/lib/beta-participation";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Error: Missing DATABASE_URL environment variable");
  process.exit(1);
}

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
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

async function recordBetaDefectReview() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const participantResult = await client.query<{ user_id: string; consented_at: string }>(
      `SELECT user_id, consented_at
         FROM beta_participants
        WHERE participant_label = $1
          AND segment = ANY($2::text[])
        FOR UPDATE`,
      [review.participantLabel, BETA_SEGMENTS],
    );
    const participant = participantResult.rows[0];
    if (!participant) throw new Error("Current-scope beta participant not found.");

    const result = await client.query<{ reviewed_at: string }>(
      `INSERT INTO beta_defect_reviews
         (user_id, consented_at, reviewer_name, review_version,
          unresolved_severity_1, unresolved_severity_2, reviewed_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
       ON CONFLICT (user_id, consented_at) DO UPDATE SET
         reviewer_name = EXCLUDED.reviewer_name,
         review_version = EXCLUDED.review_version,
         unresolved_severity_1 = EXCLUDED.unresolved_severity_1,
         unresolved_severity_2 = EXCLUDED.unresolved_severity_2,
         reviewed_at = NOW(),
         updated_at = NOW()
       RETURNING reviewed_at::text`,
      [
        participant.user_id,
        participant.consented_at,
        review.reviewerName,
        review.reviewVersion,
        review.unresolvedSeverity1,
        review.unresolvedSeverity2,
      ],
    );
    await client.query("COMMIT");
    console.log(
      `${review.participantLabel} | severity-1=${review.unresolvedSeverity1} | severity-2=${review.unresolvedSeverity2} | critical=${review.criticalDefects} | status=reviewed | reviewed=${result.rows[0].reviewed_at}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error instanceof Error ? error.message : "Unable to record beta defect review");
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void recordBetaDefectReview();
