import { NextResponse } from "next/server";
import { z } from "zod";
import { queryOne } from "@/lib/db/client";
import { requireOrganizationPermission } from "@/lib/auth/organization-access";
import { getStripe } from "@/lib/stripe";
import { buildOrganizerCheckoutParams, isOrganizerCheckoutAvailable, organizerPlanPriceId } from "@/lib/billing";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { BETA_MODE, ORGANIZER_PLANS, type OrganizerPlan } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ organizationId: string }> };

const checkoutSchema = z.object({
  plan: z.enum(Object.keys(ORGANIZER_PLANS) as [OrganizerPlan, ...OrganizerPlan[]]),
}).strict();

export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "view_organization");
  if (auth.error) return auth.error;
  if (auth.role !== "owner") {
    return NextResponse.json({ error: "Only workspace owners can change the plan." }, { status: 403 });
  }

  if (BETA_MODE) {
    return NextResponse.json(
      { error: "Paid checkout is disabled during the controlled beta" },
      { status: 503 }
    );
  }

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  const plan = parsed.data.plan;

  const priceId = organizerPlanPriceId(plan);
  if (!isOrganizerCheckoutAvailable(plan) || !priceId) {
    return NextResponse.json({ error: "Test billing is not configured" }, { status: 503 });
  }

  const { success } = await rateLimit(`org-checkout:${auth.user.id}`, { max: 10, windowSeconds: 3600 });
  if (!success) {
    return NextResponse.json({ error: "Too many checkout attempts. Please try again later." }, { status: 429 });
  }

  const organization = await queryOne<{ is_personal: boolean }>(
    "SELECT is_personal FROM organizations WHERE id = $1",
    [organizationId],
  );
  if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (organization.is_personal) {
    return NextResponse.json({ error: "Organizer plans apply to team workspaces. Create a team workspace first." }, { status: 400 });
  }

  const existing = await queryOne<{ status: string }>(
    "SELECT status FROM organization_subscriptions WHERE organization_id = $1 AND status IN ('active', 'trialing', 'past_due')",
    [organizationId],
  );
  if (existing) {
    return NextResponse.json({ error: "This workspace already has a subscription." }, { status: 409 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app").replace(/\/$/, "");

  try {
    const session = await getStripe().checkout.sessions.create(
      buildOrganizerCheckoutParams({
        organizationId,
        userId: auth.user.id,
        userEmail: auth.user.email,
        plan,
        priceId,
        siteUrl,
      })
    );
    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
    await recordActivationEventSafely({ name: "checkout_started", userId: auth.user.id, metadata: { plan: `organizer_${plan}` } });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe organizer checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
