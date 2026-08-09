import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { TIERS } from "@/lib/constants";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { toStoredSubscriptionStatus } from "@/lib/billing";

// Map legacy tier names to unified names
const TIER_ALIAS: Record<string, string> = {
  standard: "silver",
  premium: "gold",
};

async function handleEventCheckout(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
  const { eventId, tier } = session.metadata || {};

  if (!eventId || !tier) return;

  // Validate eventId is a UUID to prevent injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) return;

  // Resolve legacy names (standard -> silver, premium -> gold)
  const resolvedTier = TIER_ALIAS[tier] || tier;
  const tierKey = resolvedTier as keyof typeof TIERS;

  if (!(tierKey in TIERS)) return;

  const maxResponses = TIERS[tierKey].maxResponses;

  await query(
    'UPDATE events SET tier = $1, max_responses = $2, payment_id = $3 WHERE id = $4',
    [tierKey, maxResponses, session.id, eventId]
  );
  const userId = session.metadata?.userId;
  await recordActivationEventSafely({ name: "checkout_completed", userId, eventId, metadata: { plan: tier } });
}

const VALID_SUBSCRIPTION_TIERS = ["pro_annual"];

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
  const { userId, tier, billing } = session.metadata || {};
  if (!userId || !tier) return;

  // Validate userId is a UUID and tier is a known subscription tier
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return;
  if (!VALID_SUBSCRIPTION_TIERS.includes(tier)) return;

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null;

  await query(
    `INSERT INTO user_subscriptions (user_id, stripe_customer_id, stripe_subscription_id, tier, billing_cycle, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (stripe_subscription_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       tier = EXCLUDED.tier,
       billing_cycle = EXCLUDED.billing_cycle,
       status = EXCLUDED.status,
       updated_at = EXCLUDED.updated_at`,
    [userId, stripeCustomerId, stripeSubscriptionId, tier, billing ?? null, "active", new Date().toISOString()]
  );
  await recordActivationEventSafely({ name: "checkout_completed", userId, metadata: { plan: tier } });
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  // Determine tier from price metadata or current DB record
  let tier: string | undefined;

  // Try to find tier from subscription metadata
  if (subscription.metadata?.tier) {
    tier = subscription.metadata.tier;
  }

  const status = toStoredSubscriptionStatus(subscription.status);
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const updatedAt = new Date().toISOString();

  if (tier && VALID_SUBSCRIPTION_TIERS.includes(tier)) {
    await query(
      `UPDATE user_subscriptions SET status = $1, current_period_end = $2, updated_at = $3, tier = $4, stripe_subscription_id = $5
       WHERE stripe_subscription_id = $5`,
      [status, currentPeriodEnd, updatedAt, tier, subscription.id]
    );
  } else {
    await query(
      `UPDATE user_subscriptions SET status = $1, current_period_end = $2, updated_at = $3, stripe_subscription_id = $4
       WHERE stripe_subscription_id = $4`,
      [status, currentPeriodEnd, updatedAt, subscription.id]
    );
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  await query(
    `UPDATE user_subscriptions SET tier = $1, status = $2, updated_at = $3
     WHERE stripe_subscription_id = $4`,
    ["free", "canceled", new Date().toISOString(), subscription.id]
  );
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceAny = invoice as unknown as { subscription: string | { id: string } | null | undefined };
  const subscriptionId =
    typeof invoiceAny.subscription === "string"
      ? invoiceAny.subscription
      : invoiceAny.subscription?.id;

  if (!subscriptionId) return;

  await query(
    `UPDATE user_subscriptions SET status = $1, updated_at = $2
     WHERE stripe_subscription_id = $3`,
    ["past_due", new Date().toISOString(), subscriptionId]
  );
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const invoiceAny = invoice as unknown as { subscription: string | { id: string } | null | undefined };
  const subscriptionId =
    typeof invoiceAny.subscription === "string"
      ? invoiceAny.subscription
      : invoiceAny.subscription?.id;

  if (!subscriptionId) return;

  await query(
    `UPDATE user_subscriptions SET status = $1, updated_at = $2
     WHERE stripe_subscription_id = $3 AND status <> 'canceled'`,
    ["active", new Date().toISOString(), subscriptionId]
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const receipt = await query<{ event_id: string }>(
    `INSERT INTO webhook_receipts (provider, event_id)
     VALUES ('stripe', $1)
     ON CONFLICT DO NOTHING
     RETURNING event_id`,
    [event.id]
  );
  if (!receipt[0]) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await handleSubscriptionCheckout(session);
        } else {
          await handleEventCheckout(session);
        }
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_failed": {
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      }
      case "invoice.paid": {
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      }
    }
  } catch (error) {
    // Release the receipt so Stripe can retry a transient database/runtime failure.
    await query("DELETE FROM webhook_receipts WHERE provider = 'stripe' AND event_id = $1", [event.id]);
    throw error;
  }

  return NextResponse.json({ received: true });
}
