#!/usr/bin/env tsx

import { classifyBetaInvite } from "../src/lib/beta-invite-operations";
import { query } from "../src/lib/db/client";
import betaAcceptancePolicy from "../config/beta-acceptance-policy.json";
import { isoText, requireCliDatabase } from "./lib/cli-database";

requireCliDatabase();

interface InviteRow {
  participant_label: string;
  segment: string;
  cohort_version: string;
  token_preview: string;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

async function listBetaInvites() {
  try {
    const rows = await query<InviteRow>(
      `SELECT participant_label,
              segment,
              cohort_version,
              token_preview,
              expires_at,
              accepted_at,
              revoked_at,
              created_at
         FROM beta_enrollment_invites
        WHERE cohort_version = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [betaAcceptancePolicy.cohortVersion],
    );
    if (rows.length === 0) {
      console.log("No beta invitations found.");
      return;
    }
    for (const row of rows) {
      const status = classifyBetaInvite({
        acceptedAt: isoText(row.accepted_at),
        revokedAt: isoText(row.revoked_at),
        expiresAt: isoText(row.expires_at),
      });
      console.log([
        row.participant_label,
        row.segment,
        `cohort=${row.cohort_version}`,
        `preview=...${row.token_preview}`,
        `status=${status}`,
        `expires=${isoText(row.expires_at)}`,
        `created=${isoText(row.created_at)}`,
      ].join(" | "));
    }
  } catch (error) {
    console.error("Error listing beta invitations:", error);
    process.exitCode = 1;
  }
}

void listBetaInvites();
