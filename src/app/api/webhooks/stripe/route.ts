import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIERS } from "@/lib/constants";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

async function handleEventCheckout(session: Stripe.Checkout.Session) {
  const { eventId, tier } = session.metadata || {};

  if (!eventId || !tier) return;

  const tierKey = tier as keyof typeof TIERS;
  if (tierKey !== "standard" && tierKey !== "premium") return;

  const maxResponses = TIERS[tierKey].maxResponses;
  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from("events")
    .update({
      tier: tierKey,
      max_responses: maxResponses,
      payment_id: session.id,
    })
    .eq("id", eventId);

  if (error) {
    console.error("Failed to update event after payment:", error);
  }
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const { userId, tier, billing } = session.metadata || {};
  if (!userId || !tier) return;

  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase.from("user_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id:
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null,
      stripe_subscription_id:
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id ?? null,
      tier,
      billing_cycle: billing ?? null,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  if (error) {
    console.error("Failed to upsert subscription after checkout:", error);
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  const adminSupabase = createAdminClient();

  // Determine tier from price metadata or current DB record
  const priceId = subscription.items.data[0]?.price?.id;
  let tier: string | undefined;

  // Try to find tier from subscription metadata
  if (subscription.metadata?.tier) {
    tier = subscription.metadata.tier;
  }

  const updateData: Record<string, unknown> = {
    status: subscription.status === "active" ? "active" : subscription.status,
    current_period_end: new Date(
      subscription.current_period_end * 1000
    ).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (tier) {
    updateData.tier = tier;
  }

  if (priceId) {
    // Store price ID info for reference
    updateData.stripe_subscription_id = subscription.id;
  }

  const { error } = await adminSupabase
    .from("user_subscriptions")
    .update(updateData)
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Failed to update subscription:", error);
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from("user_subscriptions")
    .update({
      tier: "free",
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Failed to handle subscription deletion:", error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) return;

  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from("user_subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Failed to handle payment failure:", error);
  }
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
