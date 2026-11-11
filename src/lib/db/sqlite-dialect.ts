/**
 * Shared by the SQLite clients (node:sqlite locally, D1 on Workers). See schema.sql for the
 * storage conventions and docs/d1-port.md for the plan.
 *
 * Queries keep Postgres-style `$1` placeholders; SQLite reads `?1` the same way. Values are
 * encoded on the way in and decoded by column name on the way out, so rows keep the JS types
 * the pg driver used to return (Date, boolean, parsed JSON).
 */

export type SqlValue = string | number | null;
export type Statement = { text: string; params?: unknown[] };

// Column names by stored kind. tests/sqlite-dialect.test.ts checks these against schema.sql;
// no name is used with two different kinds, so decoding by name is safe.
export const BOOLEAN_COLUMNS: ReadonlySet<string> = new Set([
  "active", "allow_plus_ones", "approved", "auto_reminders", "cancel_at_period_end", "closed", "countdown_enabled",
  "guests_enabled", "helpful", "invite_sent", "is_default", "is_enabled", "is_personal", "is_plus_one", "is_private",
  "is_required", "may_contact", "photo_approval", "photos_enabled", "polls_enabled", "reactions_enabled", "show_name",
  "white_label",
]);

export const TIMESTAMP_COLUMNS: ReadonlySet<string> = new Set([
  "accepted_at", "approved_at", "cancelled_at", "checked_in_at", "completed_at", "consented_at", "created_at",
  "current_period_end", "delivered_at", "dispatched_at", "event_date", "event_end_date", "expires_at", "invite_sent_at",
  "last_attempted_at", "last_delivered_at", "last_failure_at", "last_login_at", "last_success_at", "magic_token_expires_at",
  "next_attempt_at", "phone_invalid_at", "queued_at", "reminder_sent_at", "requested_at", "revoked_at", "reviewed_at",
  "rsvp_deadline", "scheduled_at", "scheduled_for", "sent_at", "submitted_at", "updated_at", "used_at", "withdrawn_at",
]);

export const JSON_COLUMNS: ReadonlySet<string> = new Set([
  "audience", "channels", "customization", "event_brief", "events", "metadata", "options", "payload", "plus_ones_data",
  "registry_links", "reminder_sequence", "response_data", "tags",
]);

/** `$1` → `?1`. Postgres casts and functions are rewritten in the queries themselves, not here. */
export function toSqlite(text: string): string {
  return text.replace(/\$(\d+)/g, "?$1");
}

/** Booleans become 0/1, Dates ISO strings, arrays and objects JSON text (read arrays back with json_each). */
export function encodeParam(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

export function encodeParams(params: unknown[] | undefined): SqlValue[] {
  return (params ?? []).map(encodeParam);
}

function decodeValue(column: string, value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (BOOLEAN_COLUMNS.has(column)) return value === 1 || value === true || value === "1";
  if (TIMESTAMP_COLUMNS.has(column) && typeof value === "string") return new Date(value);
  if (JSON_COLUMNS.has(column) && typeof value === "string") return JSON.parse(value);
  return value;
}

export function decodeRow<T>(row: Record<string, unknown>): T {
  const decoded: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) decoded[column] = decodeValue(column, value);
  return decoded as T;
}

/** The SQL text for "now", matching the stored timestamp format. */
export const SQL_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** SQL for "now" shifted by a SQLite modifier such as '-15 minutes' or '+7 days'. */
export function sqlNowPlus(modifier: string): string {
  if (!/^[+-]\d+(\.\d+)? (seconds|minutes|hours|days|months|years)$/.test(modifier)) throw new Error(`Bad time modifier: ${modifier}`);
  return `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '${modifier}')`;
}

const ABORT_PREFIX = "sealsend_abort:";

/**
 * A batch statement that aborts the whole batch (rolling back earlier statements) unless
 * `condition` is true when it runs. Batches run one at a time, so this replaces
 * "lock, check, then write" transactions. Catch the error and read the code with `abortCode`.
 */
export function guard(condition: string, params: unknown[], code: string): Statement {
  if (!/^[a-z_]+$/.test(code)) throw new Error(`Bad guard code: ${code}`);
  return {
    text: `SELECT json_extract('{}', CASE WHEN (${condition}) THEN '$' ELSE '$${ABORT_PREFIX}${code}' END) AS guard_ok`,
    params,
  };
}

/** The code of the `guard` that aborted a batch, or null for any other error. */
export function abortCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  return message.match(new RegExp(`\\$${ABORT_PREFIX}([a-z_]+)`))?.[1] ?? null;
}
