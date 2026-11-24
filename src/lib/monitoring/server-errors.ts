import { createHash } from "node:crypto";
import { query } from "@/lib/db/client";
import { SQL_NOW } from "@/lib/db/sqlite-dialect";

export type SafeServerError = {
  fingerprint: string;
  errorName: string;
  route: string;
  method: string;
  routerKind: string;
  routeType: string;
};

export function getAlertDeliveryTiming(env: Record<string, string | undefined> = process.env) {
  const configuredCooldown = Number(env.ALERT_DELIVERY_COOLDOWN_SECONDS || 900);
  const cooldownSeconds = Number.isFinite(configuredCooldown) ? Math.min(86_400, Math.max(60, Math.floor(configuredCooldown))) : 900;
  const configuredRetry = Number(env.ALERT_DELIVERY_RETRY_SECONDS || 60);
  const retrySeconds = Number.isFinite(configuredRetry) ? Math.min(cooldownSeconds, Math.max(10, Math.floor(configuredRetry))) : 60;
  return { cooldownSeconds, retrySeconds };
}

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
  await deliverSafeAlert(safe);
}

async function deliverSafeAlert(safe: SafeServerError): Promise<void> {
  const webhook = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  const { cooldownSeconds, retrySeconds } = getAlertDeliveryTiming();
  try {
    const now = Date.now();
    // One conditional upsert claims the alert, so parallel errors deliver it once.
    const claim = await query<{ fingerprint: string }>(
      `INSERT INTO monitoring_alert_deliveries (fingerprint, last_attempted_at, last_delivery_status, attempt_count)
       VALUES ($1, ${SQL_NOW}, 'pending', 1)
       ON CONFLICT (fingerprint) DO UPDATE SET
         last_attempted_at = ${SQL_NOW},
         last_delivery_status = 'pending',
         attempt_count = monitoring_alert_deliveries.attempt_count + 1
       WHERE monitoring_alert_deliveries.last_attempted_at < $2
         AND (monitoring_alert_deliveries.last_delivered_at IS NULL OR monitoring_alert_deliveries.last_delivered_at < $3)
       RETURNING fingerprint`,
      [safe.fingerprint, new Date(now - retrySeconds * 1000), new Date(now - cooldownSeconds * 1000)],
    );
    if (!claim[0]) return;

    let delivered = false;
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "sealsend", environment: process.env.NODE_ENV || "unknown", ...safe }),
        signal: AbortSignal.timeout(5000),
      });
      delivered = response.ok;
    } catch { /* A future error can retry after the configured interval. */ }

    await query(
      `UPDATE monitoring_alert_deliveries
       SET last_delivery_status = $2,
           last_delivered_at = CASE WHEN $2 = 'delivered' THEN ${SQL_NOW} ELSE last_delivered_at END
       WHERE fingerprint = $1`,
      [safe.fingerprint, delivered ? "delivered" : "failed"],
    );
  } catch { /* Monitoring must never cause a second application failure. */ }
}
