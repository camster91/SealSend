import type { DatabaseSync } from "node:sqlite";
import { openSqliteDb, type SqliteDb } from "./sqlite-local";
import type { Statement } from "./sqlite-dialect";

/**
 * Local SQLite (dev, tests, scripts). The Worker build swaps in client.cloudflare.ts (D1).
 * SQLITE_PATH picks the file; ":memory:" gives a throwaway database.
 */
let db: SqliteDb | null = null;

function local(): SqliteDb {
  db ??= openSqliteDb(process.env.SQLITE_PATH ?? ".data/sealsend.db");
  return db;
}

export function getDb(): DatabaseSync {
  return local().handle;
}

export function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  return local().query<T>(text, params);
}

export function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  return local().queryOne<T>(text, params);
}

/** Runs the statements in order, all or nothing (D1's batch semantics). Returns each statement's rows. */
export function batch<T = unknown>(statements: Statement[]): Promise<T[][]> {
  return local().batch<T>(statements);
}

/** Runs a script of statements without parameters (for example the schema). */
export function exec(sql: string): Promise<void> {
  return local().exec(sql);
}
