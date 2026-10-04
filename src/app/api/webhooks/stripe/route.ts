import { NextRequest, NextResponse } from "next/server";
import { getDb, query } from "@/lib/db/client";
import { TIERS } from "@/lib/constants";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import {
  invoiceSubscriptionId,
  isOrganizerPlan,
  organizationPlanForSubscription,
  organizerPlanFromSubscription,
  subscriptionPeriodEnd,
  toStoredSubscriptionStatus,
  type StoredSubscriptionStatus,
} from "@/lib/billing";
import type { OrganizerPlan } from "@/lib/constants";
import { EVENT_PASS, SMS_TOP_UP } from "@/lib/constants";
import { grantSmsSegments } from "@/lib/sms-allowance";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Map legacy tier names to unified names
const TIER_ALIAS: Record<string, string> = {
  standard: "silver",
  premium: "gold",
};

async function handleSmsTopUpCheckout(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
  const { eventId, userId } = session.metadata || {};
  if (!eventId || !UUID_PATTERN.test(eventId)) return;
  // The granted amount comes from server constants, never from metadata.
  await grantSmsSegments(eventId, SMS_TOP_UP.segments, "sms_top_up", `stripe:${session.id}`);
  await recordActivationEventSafely({ name: "checkout_completed", userId, eventId, metadata: { plan: "sms_top_up" } });
}

async function handleEventCheckout(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
  if (session.metadata?.kind === "sms_top_up") return handleSmsTopUpCheckout(session);
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
  if (tierKey === "event_pass") {
    await grantSmsSegments(eventId, EVENT_PASS.smsSegmentsIncluded, "event_pass", `stripe:${session.id}`);
  }
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

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Stores the workspace subscription and applies the matching organizations.plan in one transaction.
 * A workspace holds one subscription at a time: an event for a different subscription only replaces
 * the stored one after that was cancelled, so a late event for an old subscription can't overwrite
 * the plan the workspace pays for now.
 */
async function syncOrganizationSubscription(input: {
  organizationId: string;
  plan: OrganizerPlan;
  status: StoredSubscriptionStatus;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}) {
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const stored = await client.query(
      `INSERT INTO organization_subscriptions (organization_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, cancel_at_period_end, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (organization_id) DO UPDATE SET
         stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, organization_subscriptions.stripe_customer_id),
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         current_period_end = COALESCE(EXCLUDED.current_period_end, organization_subscriptions.current_period_end),
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         updated_at = NOW()
       WHERE organization_subscriptions.stripe_subscription_id = EXCLUDED.stripe_subscription_id
          OR organization_subscriptions.status = 'canceled'
       RETURNING organization_id`,
      [input.organizationId, input.stripeCustomerId, input.stripeSubscriptionId, input.plan, input.status, input.currentPeriodEnd, input.cancelAtPeriodEnd]
    );
    if (stored.rowCount) {
      await client.query(
        "UPDATE organizations SET plan = $1, updated_at = NOW() WHERE id = $2 AND NOT is_personal",
        [organizationPlanForSubscription(input.plan, input.status), input.organizationId]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function handleOrganizerCheckout(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
  const { organizationId, plan, userId } = session.metadata || {};
  if (!organizationId || !UUID_PATTERN.test(organizationId) || !isOrganizerPlan(plan)) return;
  const stripeSubscriptionId = idOf(session.subscription as string | Stripe.Subscription | null);
  if (!stripeSubscriptionId) return;

  await syncOrganizationSubscription({
    organizationId,
    plan,
    status: "active",
    stripeSubscriptionId,
    stripeCustomerId: idOf(session.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  });
  await recordActivationEventSafely({ name: "checkout_completed", userId, metadata: { plan: `organizer_${plan}` } });
}

async function handleOrganizerSubscriptionChange(subscription: Stripe.Subscription, deleted: boolean) {
  const { organizationId } = subscription.metadata || {};
  if (!organizationId || !UUID_PATTERN.test(organizationId)) return;
  // The billed price decides the plan, so upgrades and downgrades apply even if metadata is stale.
  const plan = organizerPlanFromSubscription(subscription);
  if (!plan) return;

  await syncOrganizationSubscription({
    organizationId,
    plan,
    status: deleted ? "canceled" : toStoredSubscriptionStatus(subscription.status),
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: idOf(subscription.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null),
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
    cancelAtPeriodEnd: !deleted && Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
  });
}

/** Invoice outcomes for workspace subscriptions; a no-op for subscriptions that aren't organizer plans. */
async function handleOrganizerInvoice(subscriptionId: string, status: "active" | "past_due") {
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const row = (await client.query<{ organization_id: string; plan: OrganizerPlan }>(
      `UPDATE organization_subscriptions SET status = $1, updated_at = NOW()
        WHERE stripe_subscription_id = $2 AND status <> 'canceled'
        RETURNING organization_id, plan`,
      [status, subscriptionId]
    )).rows[0];
    if (row) {
      await client.query(
        "UPDATE organizations SET plan = $1, updated_at = NOW() WHERE id = $2 AND NOT is_personal",
        [organizationPlanForSubscription(row.plan, status), row.organization_id]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
  const currentPeriodEnd = subscriptionPeriodEnd(subscription);
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
  const subscriptionId = invoiceSubscriptionId(invoice);

  if (!subscriptionId) return;

  await query(
    `UPDATE user_subscriptions SET status = $1, updated_at = $2
     WHERE stripe_subscription_id = $3`,
    ["past_due", new Date().toISOString(), subscriptionId]
  );
  await handleOrganizerInvoice(subscriptionId, "past_due");
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);

  if (!subscriptionId) return;

  await query(
    `UPDATE user_subscriptions SET status = $1, updated_at = $2
     WHERE stripe_subscription_id = $3 AND status <> 'canceled'`,
    ["active", new Date().toISOString(), subscriptionId]
  );
  await handleOrganizerInvoice(subscriptionId, "active");
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

  // Test-only payments must never grant access from a live-mode event.
  if (process.env.PAYMENTS_TEST_ONLY === "true" && event.livemode) {
    return NextResponse.json({ received: true, ignored: "livemode" });
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
        if (session.mode === "subscription" && session.metadata?.kind === "organizer_plan") {
          await handleOrganizerCheckout(session);
        } else if (session.mode === "subscription") {
          await handleSubscriptionCheckout(session);
        } else {
          await handleEventCheckout(session);
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.metadata?.kind === "organizer_plan") await handleOrganizerSubscriptionChange(subscription, false);
        else await handleSubscriptionUpdated(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.metadata?.kind === "organizer_plan") await handleOrganizerSubscriptionChange(subscription, true);
        else await handleSubscriptionDeleted(subscription);
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
