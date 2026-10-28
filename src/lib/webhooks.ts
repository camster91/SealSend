import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { query, queryOne } from "@/lib/db/client";
import { BETA_MODE, ORGANIZER_PLANS } from "@/lib/constants";
import { postWebhook } from "@/lib/webhook-transport";
import type { WebhookAttemptResult } from "@/lib/webhook-shared";

export { isPrivateAddress, webhookUrlProblem } from "@/lib/webhook-url";

/**
 * Outbound workspace webhooks: SealSend POSTs signed JSON to an organizer's
 * endpoint when something happens on one of their events, so RSVPs,
 * check-ins and approvals can flow into their CRM, Zapier or Make.
 */

export const WEBHOOK_EVENT_TYPES = ["rsvp.submitted", "guest.checked_in", "event.published", "client.approved"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const MAX_WEBHOOKS_PER_ORGANIZATION = 5;
export { WEBHOOK_TIMEOUT_MS, type WebhookAttemptResult } from "@/lib/webhook-shared";
/** Minutes to wait after each failed attempt; the delivery fails for good after the last one. */
export const WEBHOOK_RETRY_MINUTES = [1, 5, 30, 120, 720] as const;
export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_MINUTES.length + 1;
export const WEBHOOK_DELIVERY_RETENTION_DAYS = 30;
const WEBHOOK_DELIVERY_CONCURRENCY = 5;

const WEBHOOK_PLANS: ReadonlySet<string> = new Set(Object.keys(ORGANIZER_PLANS));

/** Webhooks are an organizer-plan feature; during the controlled beta every workspace gets them. */
export function canUseWebhooks(organizationPlan: string | null | undefined, betaMode: boolean = BETA_MODE): boolean {
  return betaMode || Boolean(organizationPlan && WEBHOOK_PLANS.has(organizationPlan));
}

export const webhookInputSchema = z.object({
  url: z.string().trim().max(500).url("Enter a valid URL"),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1, "Choose at least one event").max(WEBHOOK_EVENT_TYPES.length),
  description: z.string().trim().max(120).optional().transform((value) => value || null),
}).strict();

export const webhookUpdateSchema = z.object({
  active: z.boolean().optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1, "Choose at least one event").max(WEBHOOK_EVENT_TYPES.length).optional(),
}).strict();

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

/** Signature header value: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`. */
export function signWebhookPayload(secret: string, body: string, timestampSeconds: number): string {
  const signature = createHmac("sha256", secret).update(`${timestampSeconds}.${body}`).digest("hex");
  return `t=${timestampSeconds},v1=${signature}`;
}

/** Reference verifier (also used in tests and the docs example). */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=", 2) as [string, string]));
  const timestamp = Number(parts.t);
  if (!Number.isInteger(timestamp) || !parts.v1 || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = Buffer.from(signWebhookPayload(secret, body, timestamp).split("v1=")[1], "hex");
  const given = Buffer.from(parts.v1, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** When the next attempt is due after `attempts` failures, or null when the delivery has run out of retries. */
export function nextWebhookAttemptAt(attempts: number, from: Date = new Date()): Date | null {
  if (attempts >= WEBHOOK_MAX_ATTEMPTS) return null;
  const minutes = WEBHOOK_RETRY_MINUTES[Math.max(0, attempts - 1)];
  return new Date(from.getTime() + minutes * 60_000);
}

export type WebhookEnvelope = {
  id: string;
  type: WebhookEventType | "webhook.test";
  created_at: string;
  organization_id: string;
  data: Record<string, unknown>;
};

export function webhookHeaders(secret: string, envelope: WebhookEnvelope, body: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  return {
    "Content-Type": "application/json",
    "User-Agent": "SealSend-Webhooks/1.0",
    "SealSend-Event": envelope.type,
    "SealSend-Delivery": envelope.id,
    "SealSend-Signature": signWebhookPayload(secret, body, nowSeconds),
  };
}

/**
 * Queues a webhook delivery for every active endpoint in the event's
 * workspace that subscribes to `type`. Never throws: webhooks must not break
 * the RSVP, check-in or approval that triggered them.
 */
export async function enqueueWebhookEvent(eventId: string, type: WebhookEventType, data: Record<string, unknown>): Promise<void> {
  try {
    await query(
      `INSERT INTO webhook_deliveries (webhook_id, event_type, payload)
       SELECT w.id, $2, jsonb_build_object(
                'type', $2::text,
                'created_at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                'organization_id', o.id,
                'data', $3::jsonb || jsonb_build_object('event', jsonb_build_object('id', e.id, 'title', e.title, 'slug', e.slug, 'event_date', e.event_date)))
         FROM events e
         JOIN organizations o ON o.id = e.organization_id
         JOIN organization_webhooks w ON w.organization_id = o.id
        WHERE e.id = $1 AND w.active AND $2 = ANY(w.events) AND ($5 OR o.plan = ANY($4::text[]))`,
      [eventId, type, JSON.stringify(data), [...WEBHOOK_PLANS], BETA_MODE],
    );
  } catch (error) {
    console.error("[webhooks] Failed to queue", type, error instanceof Error ? error.message : error);
  }
}

type DueDelivery = { id: string; webhook_id: string; event_type: string; payload: Omit<WebhookEnvelope, "id">; attempts: number; url: string; secret: string };

/** Claims up to `limit` due deliveries, attempts each once and schedules retries. Used by the cron route. */
export async function deliverDueWebhooks(limit = 50): Promise<{ attempted: number; delivered: number; failed: number }> {
  const due = await query<DueDelivery>(
    `UPDATE webhook_deliveries d
        SET next_attempt_at = NOW() + INTERVAL '5 minutes'
      FROM organization_webhooks w
      WHERE d.webhook_id = w.id AND d.id IN (
        -- Paused endpoints keep their queued deliveries until they are resumed.
        SELECT pending.id FROM webhook_deliveries pending
          JOIN organization_webhooks endpoint ON endpoint.id = pending.webhook_id AND endpoint.active
         WHERE pending.status = 'pending' AND pending.next_attempt_at <= NOW()
         ORDER BY pending.next_attempt_at
         LIMIT $1
         FOR UPDATE OF pending SKIP LOCKED)
      RETURNING d.id, d.webhook_id, d.event_type, d.payload, d.attempts, w.url, w.secret`,
    [limit],
  );
  let delivered = 0;
  let failed = 0;
  const attempt = async (delivery: DueDelivery) => {
    const envelope: WebhookEnvelope = { id: delivery.id, ...delivery.payload };
    const body = JSON.stringify(envelope);
    const result = await postWebhook(delivery.url, body, webhookHeaders(delivery.secret, envelope, body));
    const attempts = delivery.attempts + 1;
    if (result.ok) {
      delivered++;
      await query(
        `UPDATE webhook_deliveries SET status = 'delivered', attempts = $2, last_status_code = $3, last_error = NULL, delivered_at = NOW() WHERE id = $1`,
        [delivery.id, attempts, result.statusCode],
      );
      await query(`UPDATE organization_webhooks SET last_success_at = NOW(), consecutive_failures = 0 WHERE id = $1`, [delivery.webhook_id]);
      return;
    }
    const next = nextWebhookAttemptAt(attempts);
    if (!next) failed++;
    await query(
      `UPDATE webhook_deliveries SET status = $2, attempts = $3, last_status_code = $4, last_error = $5, next_attempt_at = COALESCE($6, next_attempt_at) WHERE id = $1`,
      [delivery.id, next ? "pending" : "failed", attempts, result.statusCode, result.error, next],
    );
    await query(`UPDATE organization_webhooks SET last_failure_at = NOW(), consecutive_failures = consecutive_failures + 1 WHERE id = $1`, [delivery.webhook_id]);
  };
  // A few at a time, so one slow endpoint can't hold up the whole run.
  for (let index = 0; index < due.length; index += WEBHOOK_DELIVERY_CONCURRENCY) {
    await Promise.all(due.slice(index, index + WEBHOOK_DELIVERY_CONCURRENCY).map(attempt));
  }
  await query(
    `DELETE FROM webhook_deliveries WHERE status IN ('delivered', 'failed') AND created_at < NOW() - make_interval(days => $1)`,
    [WEBHOOK_DELIVERY_RETENTION_DAYS],
  );
  return { attempted: due.length, delivered, failed };
}

/** Sends a signed `webhook.test` event straight away and reports the result. */
export async function sendTestWebhook(webhookId: string, organizationId: string): Promise<WebhookAttemptResult | null> {
  const webhook = await queryOne<{ url: string; secret: string }>(
    `SELECT url, secret FROM organization_webhooks WHERE id = $1 AND organization_id = $2`,
    [webhookId, organizationId],
  );
  if (!webhook) return null;
  const envelope: WebhookEnvelope = {
    id: `test_${randomBytes(8).toString("hex")}`,
    type: "webhook.test",
    created_at: new Date().toISOString(),
    organization_id: organizationId,
    data: { message: "This is a test event from SealSend." },
  };
  const body = JSON.stringify(envelope);
  return postWebhook(webhook.url, body, webhookHeaders(webhook.secret, envelope, body));
}
