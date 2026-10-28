import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeRow, encodeParams, toSqlite, type Statement } from "./sqlite-dialect";

/**
 * Local SQLite (dev, tests, scripts). Replaces client.ts when the D1 port lands (docs/d1-port.md).
 * SQLITE_PATH picks the file; ":memory:" gives a throwaway database.
 */
let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    const path = process.env.SQLITE_PATH ?? ".data/sealsend.db";
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    db = new DatabaseSync(path);
    // D1 enforces foreign keys; match it.
    db.exec("PRAGMA foreign_keys = ON");
  }
  return db;
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const rows = getDb().prepare(toSqlite(text)).all(...encodeParams(params));
  return rows.map((row) => decodeRow<T>(row as Record<string, unknown>));
}

export async function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs the statements in order, all or nothing (D1's batch semantics). Returns each statement's rows. */
export async function batch<T = unknown>(statements: Statement[]): Promise<T[][]> {
  const database = getDb();
  database.exec("BEGIN");
  try {
    const results = statements.map(({ text, params }) =>
      database.prepare(toSqlite(text)).all(...encodeParams(params)).map((row) => decodeRow<T>(row as Record<string, unknown>)),
    );
    database.exec("COMMIT");
    return results;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
