import { z } from "zod";

export const BETA_WILLINGNESS_CHOICES = [
  "annual_pro",
  "per_event",
  "free_only",
  "unsure",
] as const;

export type BetaWillingnessToPay = (typeof BETA_WILLINGNESS_CHOICES)[number];

// This identifies the exact proposition shown to a host. It is stated
// willingness, not checkout or paid-conversion evidence.
export const BETA_OUTCOME_PRICE_VERSION = "usd-annual-124.99-event-8.99-49.99-2026-08-27";

const betaOutcomeSchema = z.object({
  willingnessToPay: z.enum(BETA_WILLINGNESS_CHOICES),
  repeatIntent: z.number().int().min(1).max(5),
  selfReportedSupportMinutes: z.number().int().min(0).max(600),
}).strict();

export function parseBetaOutcome(input: unknown) {
  const outcome = betaOutcomeSchema.parse(input);
  return { ...outcome, priceVersion: BETA_OUTCOME_PRICE_VERSION };
}
