import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { TIERS } from "@/lib/constants";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

async function handleEventCheckout(session: Stripe.Checkout.Session) {
  const { eventId, tier } = session.metadata || {};

  if (!eventId || !tier) return;

  const tierKey = tier as keyof typeof TIERS;
  if (tierKey !== "standard" && tierKey !== "premium") return;

  const maxResponses = TIERS[tierKey].maxResponses;

  await query(
    'UPDATE events SET tier = $1, max_responses = $2, payment_id = $3 WHERE id = $4',
    [tierKey, maxResponses, session.id, eventId]
  );
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const { userId, tier, billing } = session.metadata || {};
  if (!userId || !tier) return;

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

  const status = subscription.status === "active" ? "active" : subscription.status;
  const currentPeriodEnd = new Date(
    ((subscription as unknown as { current_period_end: number }).current_period_end ?? 0) * 1000
  ).toISOString();
  const updatedAt = new Date().toISOString();

  if (tier) {
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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription") {
        await handleSubscriptionCheckout(session);
      } else {
        await handleEventCheckout(session);
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
