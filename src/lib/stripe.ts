import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

export async function createCheckoutSession({
  eventId,
  tier,
  userId,
  eventTitle,
}: {
  eventId: string;
  tier: "standard" | "premium";
  userId: string;
  eventTitle: string;
}): Promise<string> {
  const stripe = getStripe();

  const priceId =
    tier === "standard"
      ? process.env.STRIPE_STANDARD_PRICE_ID
      : process.env.STRIPE_PREMIUM_PRICE_ID;

  if (!priceId) {
    throw new Error(`Missing Stripe price ID for tier: ${tier}`);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { eventId, tier, userId },
    success_url: `${siteUrl}/events/${eventId}?upgraded=true`,
    cancel_url: `${siteUrl}/events/${eventId}`,
    payment_intent_data: {
      metadata: { eventId, tier, userId },
      description: `${tier === "standard" ? "Standard" : "Premium"} upgrade for "${eventTitle}"`,
    },
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return session.url;
}
