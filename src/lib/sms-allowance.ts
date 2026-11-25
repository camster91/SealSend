import { batch, query, queryOne } from "@/lib/db/client";
import { abortCode, guard } from "@/lib/db/sqlite-dialect";
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
  const row = await queryOne<{ balance: number }>(
    "SELECT COALESCE(SUM(delta_segments), 0) AS balance FROM event_sms_ledger WHERE event_id = $1",
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

/**
 * Atomically reserves SMS segments before calling Twilio so concurrent sends
 * cannot drive a metered Event Pass balance negative.
 */
export async function reserveSmsSegments(
  eventId: string,
  segments: number,
  reference: string,
): Promise<SmsAllowanceDecision> {
  if (segments <= 0) return { allowed: true };
  try {
    await batch([
      guard(
        "(SELECT COALESCE(SUM(delta_segments), 0) FROM event_sms_ledger WHERE event_id = $1) >= $2",
        [eventId, segments],
        "sms_allowance_exceeded",
      ),
      {
        text: `INSERT INTO event_sms_ledger (event_id, delta_segments, reason, reference)
               VALUES ($1, $2, 'sms_sent', $3)
               ON CONFLICT (reference) DO NOTHING`,
        params: [eventId, -segments, reference],
      },
    ]);
    return { allowed: true };
  } catch (error) {
    if (abortCode(error) === "sms_allowance_exceeded") {
      return { allowed: false, balance: Math.max(0, await getSmsBalance(eventId)), required: segments };
    }
    throw error;
  }
}

/** Releases a prior reservation when the provider call fails or is skipped. */
export async function releaseSmsReservation(eventId: string, reference: string): Promise<void> {
  await query(
    "DELETE FROM event_sms_ledger WHERE event_id = $1 AND reference = $2",
    [eventId, reference],
  );
}

