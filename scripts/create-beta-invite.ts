#!/usr/bin/env tsx

import { randomBytes } from "node:crypto";

import { BETA_SEGMENTS, type BetaSegment } from "../src/lib/beta-participation";
import { query } from "../src/lib/db/client";
import { generateMagicToken, hashMagicToken, previewMagicToken } from "../src/lib/magic-token";
import betaAcceptancePolicy from "../config/beta-acceptance-policy.json";
import { DATABASE_TARGET_HELP, isoText, requireCliDatabase } from "./lib/cli-database";

const requestedSegment = process.argv[2];

requireCliDatabase();

if (!BETA_SEGMENTS.includes(requestedSegment as BetaSegment)) {
  console.error(`Usage: npm run create-beta-invite -- <${BETA_SEGMENTS.join("|")}>`);
  console.error(DATABASE_TARGET_HELP);
  process.exit(1);
}

if (betaAcceptancePolicy.status !== "approved") {
  console.error("Error: Beta enrollment is closed until the cohort policy is approved before any host consents.");
  process.exit(1);
}

const segment = requestedSegment as BetaSegment;
const token = generateMagicToken();
const participantLabel = `host-${randomBytes(6).toString("hex")}`;

async function createBetaInvite() {
  try {
    const [row] = await query<{ expires_at: Date }>(
      `INSERT INTO beta_enrollment_invites
         (token_hash, token_preview, participant_label, segment, cohort_version, expires_at)
       VALUES ($1, $2, $3, $4, $5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+7 days'))
       RETURNING expires_at`,
      [hashMagicToken(token), previewMagicToken(token), participantLabel, segment, betaAcceptancePolicy.cohortVersion],
    );
    console.log(`Participant: ${participantLabel}`);
    console.log(`Segment: ${segment}`);
    console.log(`Cohort: ${betaAcceptancePolicy.cohortVersion}`);
    console.log(`Expires: ${isoText(row.expires_at)}`);
    console.log(`Invitation code (shown once): ${token}`);
  } catch (error) {
    console.error("Error creating beta invitation:", error);
    process.exitCode = 1;
  }
}

void createBetaInvite();
