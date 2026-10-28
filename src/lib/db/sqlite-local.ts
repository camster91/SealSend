import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeRow, encodeParams, toSqlite, type Statement } from "./sqlite-dialect";

export type SqliteDb = {
  handle: DatabaseSync;
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null>;
  batch<T = unknown>(statements: Statement[]): Promise<T[][]>;
  exec(sql: string): Promise<void>;
};

/** A node:sqlite database with the same API as client.ts. ":memory:" gives a throwaway one. */
export function openSqliteDb(path: string): SqliteDb {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const handle = new DatabaseSync(path);
  // D1 enforces foreign keys; match it.
  handle.exec("PRAGMA foreign_keys = ON");
  // Dev servers and QA scripts can share one file: wait for the other writer instead of failing.
  handle.exec("PRAGMA busy_timeout = 5000");
  if (path !== ":memory:") handle.exec("PRAGMA journal_mode = WAL");

  const run = <T>({ text, params }: Statement): T[] =>
    handle.prepare(toSqlite(text)).all(...encodeParams(params)).map((row) => decodeRow<T>(row as Record<string, unknown>));

  return {
    handle,
    async query<T>(text: string, params?: unknown[]) {
      return run<T>({ text, params });
    },
    async queryOne<T>(text: string, params?: unknown[]) {
      return run<T>({ text, params })[0] ?? null;
    },
    // All or nothing, like D1's batch.
    async batch<T>(statements: Statement[]) {
      handle.exec("BEGIN");
      try {
        const results = statements.map((statement) => run<T>(statement));
        handle.exec("COMMIT");
        return results;
      } catch (error) {
        handle.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(sql: string) {
      handle.exec(sql);
    },
  };
}

/** A fresh in-memory database with the app schema loaded (tests). */
export function openTestDb(): SqliteDb {
  const db = openSqliteDb(":memory:");
  db.handle.exec(readFileSync(join(process.cwd(), "src/lib/db/schema.sql"), "utf8"));
  return db;
}
