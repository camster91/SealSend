import { AsyncLocalStorage } from "node:async_hooks";
import { Pool } from "pg";
import { getBinding } from "@/lib/runtime-bindings";

/**
 * Workers can't reuse a socket opened by another request, so each request gets
 * its own pool (see worker/index.ts). Hyperdrive pools connections to the real
 * database, so opening one per request is cheap.
 */
const requestScope = new AsyncLocalStorage<{ pool: Pool | null }>();

function connectionString(): string {
  const hyperdrive = getBinding<{ connectionString: string }>("HYPERDRIVE");
  const url = hyperdrive?.connectionString ?? process.env.DATABASE_URL;
  if (!url) throw new Error("HYPERDRIVE binding or DATABASE_URL is not configured");
  return url;
}

function createPool(): Pool {
  return new Pool({ connectionString: connectionString(), max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 });
}

export function getDb(): Pool {
  const scope = requestScope.getStore();
  if (!scope) return createPool();
  scope.pool ??= createPool();
  return scope.pool;
}

/** Runs `work` with a request-scoped pool. The runtime closes its sockets when the request ends. */
export function runWithDbScope<T>(work: () => T): T {
  return requestScope.run({ pool: null }, work);
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await getDb().query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
