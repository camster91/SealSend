import { NextRequest, NextResponse } from "next/server";
import { requireApiHost } from '@/lib/auth/api-auth';
import { getStripe } from "@/lib/stripe";
import { buildAnnualProCheckoutParams, isAnnualProCheckoutAvailable } from "@/lib/billing";

export async function POST(request: NextRequest) {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const user = auth.user;

  if (!isAnnualProCheckoutAvailable()) {
    return NextResponse.json(
      { error: "Test billing is not configured" },
      { status: 503 }
    );
  }

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

  let body: { plan?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.plan !== "pro_annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = process.env.STRIPE_PRO_YEARLY_PRICE_ID;
  if (!priceId) return NextResponse.json({ error: "Test billing is not configured" }, { status: 503 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(
      buildAnnualProCheckoutParams({
        userId: user.id,
        userEmail: user.email,
        priceId,
        siteUrl,
      })
    );

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
