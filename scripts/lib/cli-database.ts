import { existsSync } from "node:fs";

import { d1HttpConfigFromEnv } from "../../src/lib/db/d1-http";

/** How the admin CLIs pick their database; printed with usage errors. */
export const DATABASE_TARGET_HELP = [
  "Database: local SQLite by default (SQLITE_PATH, default .data/sealsend.db).",
  "Production D1: set D1_REMOTE=true with CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID and CLOUDFLARE_API_TOKEN.",
].join("\n");

/**
 * Exits with an error unless the CLI has a database to talk to: a complete D1_REMOTE
 * configuration, or an existing local SQLite file (opening a missing path would silently
 * create an empty database without the schema).
 */
export function requireCliDatabase(): void {
  try {
    if (d1HttpConfigFromEnv()) return;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(DATABASE_TARGET_HELP);
    process.exit(1);
  }
  const path = process.env.SQLITE_PATH ?? ".data/sealsend.db";
  if (path !== ":memory:" && !existsSync(path)) {
    console.error(`Error: No SQLite database at ${path}`);
    console.error(DATABASE_TARGET_HELP);
    process.exit(1);
  }
}

/** Timestamps decode to Date; print them as the stored ISO-8601 text. */
export function isoText(value: Date | string): string;
export function isoText(value: Date | string | null): string | null;
export function isoText(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}
