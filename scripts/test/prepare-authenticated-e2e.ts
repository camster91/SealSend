#!/usr/bin/env tsx

import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import betaAcceptancePolicy from "../../config/beta-acceptance-policy.json";
import { openSqliteDb } from "../../src/lib/db/sqlite-local";
import { hashMagicToken, previewMagicToken } from "../../src/lib/magic-token";
import { hashPassword } from "../../src/lib/password";

const sqlitePath = process.env.SQLITE_PATH;
const email = process.env.SEALSEND_QA_EMAIL;
const password = process.env.SEALSEND_QA_PASSWORD;
const inviteToken = process.env.SEALSEND_QA_BETA_INVITE_TOKEN;

if (process.env.SEALSEND_E2E_FIXTURE_CONFIRM !== "isolated") {
  throw new Error("Refusing to prepare the fixture without SEALSEND_E2E_FIXTURE_CONFIRM=isolated");
}
if (process.env.D1_REMOTE === "true") {
  throw new Error("Refusing to prepare the fixture with D1_REMOTE=true; it only resets a local SQLite file");
}
// The fixture deletes and recreates the file, so it only accepts one recognisable name.
if (!sqlitePath || path.basename(sqlitePath) !== "sealsend_e2e.db") {
  throw new Error("Refusing to prepare any database not named exactly sealsend_e2e.db (set SQLITE_PATH)");
}
if (!email || !password || !inviteToken) {
  throw new Error("SEALSEND_QA_EMAIL, SEALSEND_QA_PASSWORD, and SEALSEND_QA_BETA_INVITE_TOKEN are required");
}
if (!/^[A-Za-z0-9_-]{43}$/.test(inviteToken)) {
  throw new Error("SEALSEND_QA_BETA_INVITE_TOKEN must be a 43-character base64url token");
}

const qaDatabasePath = sqlitePath;
const qaEmail = email;
const qaPassword = password;
const qaInviteToken = inviteToken;

async function main() {
  // Start from an empty file (the old DROP SCHEMA public CASCADE), including WAL side files.
  for (const suffix of ["", "-wal", "-shm"]) await rm(`${qaDatabasePath}${suffix}`, { force: true });
  const db = openSqliteDb(qaDatabasePath);

  try {
    await db.exec(await readFile(path.resolve("src/lib/db/schema.sql"), "utf8"));
    await db.batch([
      {
        text: `INSERT INTO admin_users (email, password, name)
               VALUES ($1, $2, $3)
               ON CONFLICT (email) DO UPDATE SET password = excluded.password, name = excluded.name`,
        params: [qaEmail.toLowerCase(), await hashPassword(qaPassword), "Isolated QA Host"],
      },
      {
        text: `INSERT INTO beta_enrollment_invites
                 (token_hash, token_preview, participant_label, segment, cohort_version, expires_at)
               VALUES ($1, $2, 'host-e2e000000001', 'repeat_planner', $3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 day'))
               ON CONFLICT (token_hash) DO NOTHING`,
        params: [hashMagicToken(qaInviteToken), previewMagicToken(qaInviteToken), betaAcceptancePolicy.cohortVersion],
      },
    ]);
    console.log("Prepared isolated SealSend authenticated browser fixture.");
  } finally {
    db.handle.close();
  }
}

void main();
