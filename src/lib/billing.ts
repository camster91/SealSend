import type Stripe from "stripe";
import { ORGANIZER_PLANS, type OrganizerPlan } from "@/lib/constants";

type AnnualProCheckoutInput = {
  userId: string;
  userEmail?: string | null;
  priceId: string;
  siteUrl: string;
};

export function isStripeKeyAllowed(secretKey = process.env.STRIPE_SECRET_KEY): boolean {
  if (!secretKey) return false;
  return process.env.PAYMENTS_TEST_ONLY !== 'true' || secretKey.startsWith('sk_test_');
}

export function isAnnualProCheckoutAvailable(): boolean {
  return isStripeKeyAllowed() && Boolean(process.env.STRIPE_PRO_YEARLY_PRICE_ID);
}

export type StoredSubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

export function toStoredSubscriptionStatus(status: Stripe.Subscription.Status): StoredSubscriptionStatus {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") return "canceled";
  return "past_due";
}

export function buildAnnualProCheckoutParams({ userId, userEmail, priceId, siteUrl }: AnnualProCheckoutInput): Stripe.Checkout.SessionCreateParams {
  if (!priceId) throw new Error("Missing STRIPE_PRO_YEARLY_PRICE_ID environment variable");

  const metadata = { userId, tier: "pro_annual", billing: "yearly" };
  return {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    customer_email: userEmail ?? undefined,
    success_url: `${siteUrl}/dashboard?upgraded=true`,
    cancel_url: `${siteUrl}/pricing`,
    allow_promotion_codes: true,
  };
}

// ========================================
// ORGANIZER (WORKSPACE) PLANS
// ========================================

/** Env var holding the recurring monthly Stripe price for each organizer plan. */
export const ORGANIZER_PRICE_ENV: Record<OrganizerPlan, string> = {
  solo: "STRIPE_ORGANIZER_SOLO_PRICE_ID",
  studio: "STRIPE_ORGANIZER_STUDIO_PRICE_ID",
  agency: "STRIPE_ORGANIZER_AGENCY_PRICE_ID",
};

export function isOrganizerPlan(value: unknown): value is OrganizerPlan {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ORGANIZER_PLANS, value);
}

export function organizerPlanPriceId(plan: OrganizerPlan, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env[ORGANIZER_PRICE_ENV[plan]]?.trim() || undefined;
}

export function isOrganizerCheckoutAvailable(plan: OrganizerPlan): boolean {
  return isStripeKeyAllowed() && Boolean(organizerPlanPriceId(plan));
}

type OrganizerCheckoutInput = {
  organizationId: string;
  userId: string;
  userEmail?: string | null;
  plan: OrganizerPlan;
  priceId: string;
  siteUrl: string;
};

export function buildOrganizerCheckoutParams({ organizationId, userId, userEmail, plan, priceId, siteUrl }: OrganizerCheckoutInput): Stripe.Checkout.SessionCreateParams {
  if (!priceId) throw new Error(`Missing ${ORGANIZER_PRICE_ENV[plan]} environment variable`);

  const metadata = { kind: "organizer_plan", organizationId, plan, userId };
  return {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    customer_email: userEmail ?? undefined,
    client_reference_id: organizationId,
    success_url: `${siteUrl}/settings/team?upgraded=${plan}`,
    cancel_url: `${siteUrl}/settings/team?checkout=cancelled`,
    allow_promotion_codes: true,
  };
}

/**
 * Workspace plan to store for a subscription state. Only active and trialing
 * subscriptions unlock organizer features; every other state falls back to the
 * unpaid "personal" plan, matching how Pro entitlements fail closed.
 */
export function organizationPlanForSubscription(plan: OrganizerPlan, status: StoredSubscriptionStatus): OrganizerPlan | "personal" {
  return status === "active" || status === "trialing" ? plan : "personal";
}
