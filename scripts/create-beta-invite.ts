#!/usr/bin/env tsx

import { randomBytes } from "node:crypto";
import { Pool } from "pg";

import { BETA_SEGMENTS, type BetaSegment } from "../src/lib/beta-participation";
import { generateMagicToken, hashMagicToken, previewMagicToken } from "../src/lib/magic-token";

const databaseUrl = process.env.DATABASE_URL;
const requestedSegment = process.argv[2];

if (!databaseUrl) {
  console.error("Error: Missing DATABASE_URL environment variable");
  process.exit(1);
}

if (!BETA_SEGMENTS.includes(requestedSegment as BetaSegment)) {
  console.error(`Usage: npm run create-beta-invite -- <${BETA_SEGMENTS.join("|")}>`);
  process.exit(1);
}

const segment = requestedSegment as BetaSegment;
const token = generateMagicToken();
const participantLabel = `host-${randomBytes(6).toString("hex")}`;
const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

async function createBetaInvite() {
  try {
    const result = await pool.query<{ expires_at: string }>(
      `INSERT INTO beta_enrollment_invites
         (token_hash, token_preview, participant_label, segment, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
       RETURNING expires_at`,
      [hashMagicToken(token), previewMagicToken(token), participantLabel, segment],
    );
    console.log(`Participant: ${participantLabel}`);
    console.log(`Segment: ${segment}`);
    console.log(`Expires: ${result.rows[0].expires_at}`);
    console.log(`Invitation code (shown once): ${token}`);
  } catch (error) {
    console.error("Error creating beta invitation:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void createBetaInvite();
