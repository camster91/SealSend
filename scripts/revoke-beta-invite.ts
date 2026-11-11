#!/usr/bin/env tsx

import { parseBetaInviteLabel } from "../src/lib/beta-invite-operations";
import { query, queryOne } from "../src/lib/db/client";
import { DATABASE_TARGET_HELP, isoText, requireCliDatabase } from "./lib/cli-database";

const requestedLabel = process.argv[2];

requireCliDatabase();

let participantLabel: string;
try {
  participantLabel = parseBetaInviteLabel(requestedLabel);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid beta participant label");
  console.error("Usage: npm run revoke-beta-invite -- <host-xxxxxxxxxxxx>");
  console.error(DATABASE_TARGET_HELP);
  process.exit(1);
}

async function revokeBetaInvite() {
  try {
    // One conditional statement: no row back means it was accepted, already revoked or missing.
    const revoked = await query<{
      participant_label: string;
      segment: string;
      token_preview: string;
      revoked_at: Date;
    }>(
      `UPDATE beta_enrollment_invites
          SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE participant_label = $1
          AND accepted_at IS NULL
          AND revoked_at IS NULL
      RETURNING participant_label, segment, token_preview, revoked_at`,
      [participantLabel],
    );
    if (revoked.length === 1) {
      const row = revoked[0];
      console.log(`${row.participant_label} | ${row.segment} | preview=...${row.token_preview} | status=revoked | revoked=${isoText(row.revoked_at)}`);
      return;
    }

    const existing = await queryOne<{ accepted_at: Date | null; revoked_at: Date | null }>(
      `SELECT accepted_at, revoked_at
         FROM beta_enrollment_invites
        WHERE participant_label = $1`,
      [participantLabel],
    );
    if (!existing) throw new Error("Beta invitation not found.");
    if (existing.accepted_at) throw new Error("Accepted beta invitations cannot be revoked.");
    console.log(`${participantLabel} | status=already-revoked`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to revoke beta invitation");
    process.exitCode = 1;
  }
}

void revokeBetaInvite();
