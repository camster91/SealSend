import { NextResponse } from "next/server";
import { z } from "zod";
import { queryOne } from "@/lib/db/client";
import { requireOrganizationPermission } from "@/lib/auth/organization-access";
import { getStripe } from "@/lib/stripe";
import {
  changeOrganizerSubscriptionPlan,
  isOrganizerCheckoutAvailable,
  isStripeKeyAllowed,
  organizerPlanPriceId,
  setOrganizerSubscriptionCancellation,
} from "@/lib/billing";
import { BETA_MODE, ORGANIZER_PLANS, type OrganizerPlan } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ organizationId: string }> };

type StoredSubscription = {
  stripe_subscription_id: string;
  plan: OrganizerPlan;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("change"), plan: z.enum(Object.keys(ORGANIZER_PLANS) as [OrganizerPlan, ...OrganizerPlan[]]) }).strict(),
  z.object({ action: z.literal("cancel") }).strict(),
  z.object({ action: z.literal("resume") }).strict(),
]);

async function requireOwner(organizationId: string) {
  const auth = await requireOrganizationPermission(organizationId, "view_organization");
  if (auth.error) return { error: auth.error };
  if (auth.role !== "owner") {
    return { error: NextResponse.json({ error: "Only workspace owners can manage the plan." }, { status: 403 }) };
  }
  return { user: auth.user };
}

function loadSubscription(organizationId: string) {
  return queryOne<StoredSubscription>(
    `SELECT stripe_subscription_id, plan, status, current_period_end, cancel_at_period_end
       FROM organization_subscriptions WHERE organization_id = $1`,
    [organizationId],
  );
}

/** The workspace's subscription as SealSend last heard it from Stripe. Owner-only. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const owner = await requireOwner(organizationId);
  if (owner.error) return owner.error;

  const subscription = await loadSubscription(organizationId);
  return NextResponse.json({
    subscription: subscription && {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

/**
 * Change plan, cancel at period end, or resume a scheduled cancellation. Stripe
 * holds the source of truth: the signed webhook applies the result to
 * organizations.plan, so this route never grants a plan itself.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const owner = await requireOwner(organizationId);
  if (owner.error) return owner.error;

  if (BETA_MODE) {
    return NextResponse.json({ error: "Paid plans are disabled during the controlled beta" }, { status: 503 });
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const input = parsed.data;

  if (!isStripeKeyAllowed() || (input.action === "change" && !isOrganizerCheckoutAvailable(input.plan))) {
    return NextResponse.json({ error: "Test billing is not configured" }, { status: 503 });
  }

  const { success } = await rateLimit(`org-billing:${owner.user.id}`, { max: 10, windowSeconds: 3600 });
  if (!success) {
    return NextResponse.json({ error: "Too many plan changes. Please try again later." }, { status: 429 });
  }

  const subscription = await loadSubscription(organizationId);
  if (!subscription || subscription.status === "canceled") {
    return NextResponse.json({ error: "This workspace has no active subscription." }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    if (input.action === "change") {
      if (input.plan === subscription.plan) {
        return NextResponse.json({ error: "The workspace is already on this plan." }, { status: 409 });
      }
      await changeOrganizerSubscriptionPlan(stripe, {
        subscriptionId: subscription.stripe_subscription_id,
        organizationId,
        userId: owner.user.id,
        plan: input.plan,
        priceId: organizerPlanPriceId(input.plan) as string,
      });
    } else {
      await setOrganizerSubscriptionCancellation(stripe, {
        subscriptionId: subscription.stripe_subscription_id,
        organizationId,
        cancel: input.action === "cancel",
      });
    }
    return NextResponse.json({ pending: true });
  } catch (err) {
    console.error("Stripe organizer subscription update error:", err);
    return NextResponse.json({ error: "Stripe couldn't update the subscription. Please try again." }, { status: 502 });
  }
}
