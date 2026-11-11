import { decodeRow, encodeParams, toSqlite, type Statement } from "./sqlite-dialect";

/**
 * D1 over Cloudflare's HTTP API, for CLIs and scripts run from a laptop against the real database.
 * Same API as the other clients. A batch is sent as one request and runs as one transaction.
 */
export type D1HttpConfig = { accountId: string; databaseId: string; apiToken: string };

type D1HttpResult = { results?: Record<string, unknown>[] };
type D1HttpResponse = { success: boolean; errors?: { message: string }[]; result?: D1HttpResult[] };

export function d1HttpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): D1HttpConfig | null {
  if (env.D1_REMOTE !== "true") return null;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = env.D1_DATABASE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) {
    throw new Error("D1_REMOTE=true needs CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID and CLOUDFLARE_API_TOKEN");
  }
  return { accountId, databaseId, apiToken };
}

export function openD1Http(config: D1HttpConfig) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;

  async function send(body: unknown): Promise<D1HttpResult[]> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as D1HttpResponse;
    if (!response.ok || !payload.success) {
      throw new Error(`D1 HTTP query failed: ${payload.errors?.map((error) => error.message).join("; ") || response.status}`);
    }
    return payload.result ?? [];
  }

  const rowsOf = <T>(result: D1HttpResult | undefined) => (result?.results ?? []).map((row) => decodeRow<T>(row));

  return {
    async query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
      const [result] = await send({ sql: toSqlite(text), params: encodeParams(params) });
      return rowsOf<T>(result);
    },
    async queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
      const [result] = await send({ sql: toSqlite(text), params: encodeParams(params) });
      return rowsOf<T>(result)[0] ?? null;
    },
    async batch<T = unknown>(statements: Statement[]): Promise<T[][]> {
      const results = await send({ batch: statements.map(({ text, params }) => ({ sql: toSqlite(text), params: encodeParams(params) })) });
      return results.map((result) => rowsOf<T>(result));
    },
    async exec(sql: string): Promise<void> {
      await send({ sql });
    },
  };
}
