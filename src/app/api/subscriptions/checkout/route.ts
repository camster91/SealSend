import { NextRequest, NextResponse } from "next/server";
import { requireApiHost } from '@/lib/auth/api-auth';
import { getStripe } from "@/lib/stripe";
import { SUBSCRIPTION_TIERS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const user = auth.user;

  const { rateLimit } = await import("@/lib/rate-limit");
  const { success: rateLimitOk } = await rateLimit(`sub-checkout:${user.id}`, {
    max: 10,
    windowSeconds: 3600,
  });
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please try again later." },
      { status: 429 }
    );
  }

  let body: { tier: string; billing: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tier, billing } = body;

  if (!tier || !billing) {
    return NextResponse.json(
      { error: "Missing tier or billing" },
      { status: 400 }
    );
  }

  if (tier !== "pro" && tier !== "business") {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  if (billing !== "monthly" && billing !== "yearly") {
    return NextResponse.json({ error: "Invalid billing cycle" }, { status: 400 });
  }

  const tierConfig = SUBSCRIPTION_TIERS.find((t) => t.id === tier);
  if (!tierConfig) {
    return NextResponse.json({ error: "Tier not found" }, { status: 400 });
  }

  const priceId = tierConfig.stripePriceId?.[billing];
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price ID configured for ${tier} ${billing}` },
      { status: 500 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, tier, billing },
      customer_email: user.email ?? undefined,
      success_url: `${siteUrl}/dashboard?upgraded=true`,
      cancel_url: `${siteUrl}/pricing`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
