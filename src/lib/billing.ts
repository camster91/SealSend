import type Stripe from "stripe";

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
