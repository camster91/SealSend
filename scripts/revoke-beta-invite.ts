#!/usr/bin/env tsx

import { Pool } from "pg";

import { parseBetaInviteLabel } from "../src/lib/beta-invite-operations";

const databaseUrl = process.env.DATABASE_URL;
const requestedLabel = process.argv[2];

if (!databaseUrl) {
  console.error("Error: Missing DATABASE_URL environment variable");
  process.exit(1);
}

let participantLabel: string;
try {
  participantLabel = parseBetaInviteLabel(requestedLabel);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid beta participant label");
  console.error("Usage: npm run revoke-beta-invite -- <host-xxxxxxxxxxxx>");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

async function revokeBetaInvite() {
  try {
    const revoked = await pool.query<{
      participant_label: string;
      segment: string;
      token_preview: string;
      revoked_at: string;
    }>(
      `UPDATE beta_enrollment_invites
          SET revoked_at = NOW()
        WHERE participant_label = $1
          AND accepted_at IS NULL
          AND revoked_at IS NULL
      RETURNING participant_label, segment, token_preview, revoked_at::text`,
      [participantLabel],
    );
    if (revoked.rowCount === 1) {
      const row = revoked.rows[0];
      console.log(`${row.participant_label} | ${row.segment} | preview=...${row.token_preview} | status=revoked | revoked=${row.revoked_at}`);
      return;
    }

    const existing = await pool.query<{ accepted_at: string | null; revoked_at: string | null }>(
      `SELECT accepted_at::text, revoked_at::text
         FROM beta_enrollment_invites
        WHERE participant_label = $1`,
      [participantLabel],
    );
    if (existing.rowCount === 0) throw new Error("Beta invitation not found.");
    if (existing.rows[0].accepted_at) throw new Error("Accepted beta invitations cannot be revoked.");
    console.log(`${participantLabel} | status=already-revoked`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to revoke beta invitation");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void revokeBetaInvite();
