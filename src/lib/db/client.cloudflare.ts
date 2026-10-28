import { getBinding } from "@/lib/runtime-bindings";
import { decodeRow, encodeParams, toSqlite, type SqlValue, type Statement } from "./sqlite-dialect";

/**
 * Cloudflare D1 (binding `DB`), swapped in for client.ts by the Worker build.
 * D1 has no interactive transactions: use `batch` for writes that must succeed or fail together.
 */
type D1Prepared = { all<T>(): Promise<{ results: T[] }> };
type D1Statement = { bind(...values: SqlValue[]): D1Prepared };
export type D1Database = {
  prepare(text: string): D1Statement;
  batch<T>(statements: D1Prepared[]): Promise<{ results: T[] }[]>;
  exec(sql: string): Promise<unknown>;
};

export function getDb(): D1Database {
  const database = getBinding<D1Database>("DB");
  if (!database) throw new Error("D1 binding DB is not configured");
  return database;
}

function prepare({ text, params }: Statement): D1Prepared {
  return getDb().prepare(toSqlite(text)).bind(...encodeParams(params));
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const { results } = await prepare({ text, params }).all<Record<string, unknown>>();
  return results.map((row) => decodeRow<T>(row));
}

export async function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs the statements in order, all or nothing. Returns each statement's rows. */
export async function batch<T = unknown>(statements: Statement[]): Promise<T[][]> {
  const results = await getDb().batch<Record<string, unknown>>(statements.map(prepare));
  return results.map(({ results: rows }) => rows.map((row) => decodeRow<T>(row)));
}

/** Runs a script of statements without parameters (for example the schema). */
export async function exec(sql: string): Promise<void> {
  await getDb().exec(sql);
}
