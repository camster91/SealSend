import { query, queryOne } from "@/lib/db/client";
import { SMS_TOP_UP } from "@/lib/constants";
import type { AccountPlan } from "@/lib/entitlements";

/**
 * Event Pass events include a fixed number of SMS segments. Each sent SMS
 * debits its billed segments from a per-event ledger; purchases credit it.
 * Legacy one-time tiers, annual Pro and the controlled beta are not metered.
 */
export function isSmsMetered(accountPlan: AccountPlan, eventTier: string): boolean {
  if (accountPlan === "pro_annual" || accountPlan === "beta") return false;
  return eventTier === "event_pass";
}

export type SmsAllowanceDecision =
  | { allowed: true }
  | { allowed: false; balance: number; required: number };

export function decideSmsSend(metered: boolean, balance: number, requiredSegments: number): SmsAllowanceDecision {
  if (!metered || requiredSegments <= balance) return { allowed: true };
  return { allowed: false, balance: Math.max(0, balance), required: requiredSegments };
}

export function smsAllowanceMessage(decision: Extract<SmsAllowanceDecision, { allowed: false }>): string {
  return `This send needs ${decision.required} SMS segments but the event has ${decision.balance} left. Buy an SMS top-up (${SMS_TOP_UP.segments} segments) or send by email only.`;
}

export async function getSmsBalance(eventId: string): Promise<number> {
  const row = await queryOne<{ balance: string }>(
    "SELECT COALESCE(SUM(delta_segments), 0)::text AS balance FROM event_sms_ledger WHERE event_id = $1",
    [eventId],
  );
  return Number(row?.balance ?? 0);
}

/** Credits are idempotent per reference (e.g. a Stripe checkout session). */
export async function grantSmsSegments(eventId: string, segments: number, reason: "event_pass" | "sms_top_up", reference: string): Promise<void> {
  await query(
    `INSERT INTO event_sms_ledger (event_id, delta_segments, reason, reference)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (reference) DO NOTHING`,
    [eventId, segments, reason, reference],
  );
}

export async function recordSmsUsage(eventId: string, segments: number, reference: string | null): Promise<void> {
  if (segments <= 0) return;
  await query(
    `INSERT INTO event_sms_ledger (event_id, delta_segments, reason, reference)
     VALUES ($1, $2, 'sms_sent', $3)
     ON CONFLICT (reference) DO NOTHING`,
    [eventId, -segments, reference],
  );
}

