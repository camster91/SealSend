#!/usr/bin/env tsx

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

import betaAcceptancePolicy from "../../config/beta-acceptance-policy.json";
import { hashMagicToken, previewMagicToken } from "../../src/lib/magic-token";
import { hashPassword } from "../../src/lib/password";

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.SEALSEND_QA_EMAIL;
const password = process.env.SEALSEND_QA_PASSWORD;
const inviteToken = process.env.SEALSEND_QA_BETA_INVITE_TOKEN;

if (process.env.SEALSEND_E2E_FIXTURE_CONFIRM !== "isolated") {
  throw new Error("Refusing to prepare the fixture without SEALSEND_E2E_FIXTURE_CONFIRM=isolated");
}
if (!databaseUrl || new URL(databaseUrl).pathname !== "/sealsend_e2e") {
  throw new Error("Refusing to prepare any database not named exactly sealsend_e2e");
}
if (!email || !password || !inviteToken) {
  throw new Error("SEALSEND_QA_EMAIL, SEALSEND_QA_PASSWORD, and SEALSEND_QA_BETA_INVITE_TOKEN are required");
}
if (!/^[A-Za-z0-9_-]{43}$/.test(inviteToken)) {
  throw new Error("SEALSEND_QA_BETA_INVITE_TOKEN must be a 43-character base64url token");
}

const qaEmail = email;
const qaPassword = password;
const qaInviteToken = inviteToken;

async function main() {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    const schema = await readFile(path.resolve("src/lib/db/schema.sql"), "utf8");
    await pool.query(schema);
    await pool.query(
      `INSERT INTO admin_users (email, password, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, name = EXCLUDED.name`,
      [qaEmail.toLowerCase(), await hashPassword(qaPassword), "Isolated QA Host"],
    );
    await pool.query(
      `INSERT INTO beta_enrollment_invites
         (token_hash, token_preview, participant_label, segment, cohort_version, expires_at)
       VALUES ($1, $2, 'host-e2e000000001', 'repeat_planner', $3, NOW() + INTERVAL '1 day')
       ON CONFLICT (token_hash) DO NOTHING`,
      [hashMagicToken(qaInviteToken), previewMagicToken(qaInviteToken), betaAcceptancePolicy.cohortVersion],
    );
    console.log("Prepared isolated SealSend authenticated browser fixture.");
  } finally {
    await pool.end();
  }
}

void main();
