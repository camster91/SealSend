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

/** Tooling that creates Stripe objects (scripts/stripe) runs only with a test-mode secret key. */
export function assertStripeTestKey(secretKey: string | undefined): string {
  const key = secretKey?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set. Use a test-mode key that starts with sk_test_.");
  if (!key.startsWith("sk_test_")) {
    throw new Error("Refusing to run: STRIPE_SECRET_KEY must start with sk_test_. Live and restricted keys are never used here.");
  }
  return key;
}

// ========================================
// STRIPE API SHAPES
// ========================================
// The pinned API version (2026-02-25.clover) moved the billing period onto
// subscription items and the subscription reference onto invoice.parent.
// Events rendered with an older account API version still use the old fields,
// so read both.

type SubscriptionPeriodShape = {
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }> };
};

/** Latest billing-period end across the subscription's items, as an ISO string. */
export function subscriptionPeriodEnd(subscription: SubscriptionPeriodShape): string | null {
  const itemEnds = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  const seconds = itemEnds.length > 0 ? Math.max(...itemEnds) : subscription.current_period_end;
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

type InvoiceSubscriptionShape = {
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
};

/** The subscription an invoice bills, or null for one-off invoices. */
export function invoiceSubscriptionId(invoice: InvoiceSubscriptionShape): string | null {
  const reference = invoice.parent?.subscription_details?.subscription ?? invoice.subscription;
  if (!reference) return null;
  return typeof reference === "string" ? reference : reference.id;
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

/** The organizer plan a configured Stripe price belongs to, if any. */
export function organizerPlanForPrice(priceId: string | null | undefined, env: NodeJS.ProcessEnv = process.env): OrganizerPlan | null {
  if (!priceId) return null;
  const plans = Object.keys(ORGANIZER_PRICE_ENV) as OrganizerPlan[];
  return plans.find((plan) => organizerPlanPriceId(plan, env) === priceId) ?? null;
}

type OrganizerSubscriptionShape = {
  metadata?: Record<string, string> | null;
  items?: { data?: Array<{ price?: { id?: string } | null }> };
};

/**
 * Plan a workspace subscription pays for. The billed price wins over metadata,
 * so an upgrade or downgrade made outside SealSend (Stripe dashboard, portal)
 * can't leave the workspace on a plan it no longer pays for. Metadata is the
 * fallback when the price isn't one of the configured organizer prices.
 */
export function organizerPlanFromSubscription(subscription: OrganizerSubscriptionShape, env: NodeJS.ProcessEnv = process.env): OrganizerPlan | null {
  for (const item of subscription.items?.data ?? []) {
    const plan = organizerPlanForPrice(item.price?.id, env);
    if (plan) return plan;
  }
  const fromMetadata = subscription.metadata?.plan;
  return isOrganizerPlan(fromMetadata) ? fromMetadata : null;
}

type OrganizerPlanChangeInput = {
  organizationId: string;
  userId: string;
  plan: OrganizerPlan;
  priceId: string;
  subscriptionItemId: string;
};

/**
 * Switches a workspace subscription to another organizer plan. Stripe prorates
 * the difference onto the next invoice; the webhook applies the new plan once
 * Stripe confirms the update.
 */
export function buildOrganizerPlanChangeParams({ organizationId, userId, plan, priceId, subscriptionItemId }: OrganizerPlanChangeInput): Stripe.SubscriptionUpdateParams {
  if (!priceId) throw new Error(`Missing ${ORGANIZER_PRICE_ENV[plan]} environment variable`);
  if (!subscriptionItemId) throw new Error("Missing subscription item to change");
  return {
    items: [{ id: subscriptionItemId, price: priceId }],
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
    metadata: { kind: "organizer_plan", organizationId, plan, userId },
  };
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

type SubscriptionsApi = Pick<Stripe, "subscriptions">;

/**
 * Asks Stripe to move a workspace subscription to another organizer plan. Refuses
 * a subscription that belongs to a different workspace or is already cancelled.
 * The workspace plan itself changes only when the signed webhook arrives.
 */
export async function changeOrganizerSubscriptionPlan(
  stripe: SubscriptionsApi,
  input: { subscriptionId: string; organizationId: string; userId: string; plan: OrganizerPlan; priceId: string },
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
  if (subscription.metadata?.organizationId !== input.organizationId) {
    throw new Error("Subscription does not belong to this workspace");
  }
  if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
    throw new Error("Subscription is no longer active");
  }
  const item = subscription.items.data[0];
  if (!item) throw new Error("Subscription has no billed item");
  return stripe.subscriptions.update(input.subscriptionId, buildOrganizerPlanChangeParams({
    organizationId: input.organizationId,
    userId: input.userId,
    plan: input.plan,
    priceId: input.priceId,
    subscriptionItemId: item.id,
  }));
}

/** Schedules (or undoes) cancellation at the end of the paid period; access continues until then. */
export async function setOrganizerSubscriptionCancellation(
  stripe: SubscriptionsApi,
  input: { subscriptionId: string; organizationId: string; cancel: boolean },
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
  if (subscription.metadata?.organizationId !== input.organizationId) {
    throw new Error("Subscription does not belong to this workspace");
  }
  return stripe.subscriptions.update(input.subscriptionId, { cancel_at_period_end: input.cancel });
}

/**
 * Workspace plan to store for a subscription state. Only active and trialing
 * subscriptions unlock organizer features; every other state falls back to the
 * unpaid "personal" plan, matching how Pro entitlements fail closed.
 */
export function organizationPlanForSubscription(plan: OrganizerPlan, status: StoredSubscriptionStatus): OrganizerPlan | "personal" {
  return status === "active" || status === "trialing" ? plan : "personal";
}
