import type { DatabaseSync } from "node:sqlite";
import { d1HttpConfigFromEnv, openD1Http } from "./d1-http";
import { openSqliteDb, type SqliteDb } from "./sqlite-local";
import type { Statement } from "./sqlite-dialect";

/**
 * Local SQLite (dev, tests, scripts). The Worker build swaps in client.cloudflare.ts (D1).
 * SQLITE_PATH picks the file; ":memory:" gives a throwaway database. With D1_REMOTE=true
 * (plus CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID, CLOUDFLARE_API_TOKEN) scripts use the real D1 over HTTP.
 */
type Backend = Omit<SqliteDb, "handle"> & { handle?: DatabaseSync };
let backend: Backend | null = null;

function current(): Backend {
  if (!backend) {
    const remote = d1HttpConfigFromEnv();
    backend = remote ? openD1Http(remote) : openSqliteDb(process.env.SQLITE_PATH ?? ".data/sealsend.db");
  }
  return backend;
}

/** The local node:sqlite handle. Not available with D1_REMOTE. */
export function getDb(): DatabaseSync {
  const { handle } = current();
  if (!handle) throw new Error("getDb() is only available for the local SQLite database");
  return handle;
}

export function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  return current().query<T>(text, params);
}

export function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  return current().queryOne<T>(text, params);
}

/** Runs the statements in order, all or nothing (D1's batch semantics). Returns each statement's rows. */
export function batch<T = unknown>(statements: Statement[]): Promise<T[][]> {
  return current().batch<T>(statements);
}

/** Runs a script of statements without parameters (for example the schema). */
export function exec(sql: string): Promise<void> {
  return current().exec(sql);
}
