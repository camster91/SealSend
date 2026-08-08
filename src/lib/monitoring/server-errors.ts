import { createHash } from "node:crypto";
import { query } from "@/lib/db/client";

export type SafeServerError = {
  fingerprint: string;
  errorName: string;
  route: string;
  method: string;
  routerKind: string;
  routeType: string;
};

const safeSegment = (value: string) => value.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "[id]").replace(/[A-Za-z0-9_-]{20,}/g, "[token]").slice(0, 300);

export function buildSafeServerError(error: unknown, input: { route?: string; method?: string; routerKind?: string; routeType?: string }): SafeServerError {
  const errorName = error instanceof Error ? error.name.slice(0, 100) : "UnknownError";
  const route = safeSegment(input.route || "unknown");
  const method = (input.method || "UNKNOWN").toUpperCase().slice(0, 10);
  const routerKind = (input.routerKind || "unknown").slice(0, 30);
  const routeType = (input.routeType || "unknown").slice(0, 50);
  const fingerprint = createHash("sha256").update(`${errorName}\0${route}\0${method}\0${routeType}`).digest("hex");
  return { fingerprint, errorName, route, method, routerKind, routeType };
}

export async function captureServerError(error: unknown, input: { route?: string; method?: string; routerKind?: string; routeType?: string }): Promise<void> {
  const safe = buildSafeServerError(error, input);
  try {
    await query(
      `INSERT INTO server_error_events (fingerprint, error_name, route, method, router_kind, route_type)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [safe.fingerprint, safe.errorName, safe.route, safe.method, safe.routerKind, safe.routeType],
    );
  } catch { /* Monitoring must never cause a second application failure. */ }
  const webhook = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: "sealsend", environment: process.env.NODE_ENV || "unknown", ...safe }), signal: AbortSignal.timeout(5000) });
    } catch { /* Alert delivery is best effort and contains no user content. */ }
  }
}
