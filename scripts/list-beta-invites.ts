#!/usr/bin/env tsx

import { Pool } from "pg";

import { classifyBetaInvite } from "../src/lib/beta-invite-operations";

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

interface InviteRow {
  participant_label: string;
  segment: string;
  token_preview: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

async function listBetaInvites() {
  try {
    const result = await pool.query<InviteRow>(
      `SELECT participant_label,
              segment,
              token_preview,
              expires_at::text,
              accepted_at::text,
              revoked_at::text,
              created_at::text
         FROM beta_enrollment_invites
        ORDER BY created_at DESC
        LIMIT 100`,
    );
    if (result.rows.length === 0) {
      console.log("No beta invitations found.");
      return;
    }
    for (const row of result.rows) {
      const status = classifyBetaInvite({
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
        expiresAt: row.expires_at,
      });
      console.log([
        row.participant_label,
        row.segment,
        `preview=...${row.token_preview}`,
        `status=${status}`,
        `expires=${row.expires_at}`,
        `created=${row.created_at}`,
      ].join(" | "));
    }
  } catch (error) {
    console.error("Error listing beta invitations:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void listBetaInvites();
