#!/usr/bin/env tsx

import { Pool } from "pg";

import {
  BETA_SUPPORT_REVIEW_CONFIRMATION,
  parseBetaSupportReview,
} from "../src/lib/beta-support-review";
import { BETA_SEGMENTS } from "../src/lib/beta-participation";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Error: Missing DATABASE_URL environment variable");
  process.exit(1);
}

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
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

async function recordBetaSupportReview() {
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
      `INSERT INTO beta_support_reviews
         (user_id, consented_at, reviewer_name, review_version,
          operator_recorded_support_minutes, reviewed_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
       ON CONFLICT (user_id, consented_at) DO UPDATE SET
         reviewer_name = EXCLUDED.reviewer_name,
         review_version = EXCLUDED.review_version,
         operator_recorded_support_minutes = EXCLUDED.operator_recorded_support_minutes,
         reviewed_at = NOW(),
         updated_at = NOW()
       RETURNING reviewed_at::text`,
      [
        participant.user_id,
        participant.consented_at,
        review.reviewerName,
        review.reviewVersion,
        review.operatorRecordedSupportMinutes,
      ],
    );
    await client.query("COMMIT");
    console.log(
      `${review.participantLabel} | operator-support-minutes=${review.operatorRecordedSupportMinutes} | status=reviewed | reviewed=${result.rows[0].reviewed_at}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error instanceof Error ? error.message : "Unable to record beta support review");
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void recordBetaSupportReview();
