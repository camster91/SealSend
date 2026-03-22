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

// Per-event pricing (Evite-style, 50% cheaper)
const EVENT_PRICING = {
  silver: { amount: 899, name: "Silver", guests: 50 },
  gold: { amount: 1799, name: "Gold", guests: 150 },
  platinum: { amount: 3499, name: "Platinum", guests: 500 },
  diamond: { amount: 4999, name: "Diamond", guests: 750 },
} as const;

type EventTier = keyof typeof EVENT_PRICING;

export async function createCheckoutSession({
  eventId,
  tier,
  userId,
  eventTitle,
}: {
  eventId: string;
  tier: EventTier | "standard" | "premium";
  userId: string;
  eventTitle: string;
}): Promise<string> {
  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";

  // Map old tier names to new ones for backwards compatibility
  const tierMap: Record<string, EventTier> = {
    standard: "silver",
    premium: "gold",
  };
  const resolvedTier = (tierMap[tier] || tier) as EventTier;
  const pricing = EVENT_PRICING[resolvedTier];

  if (!pricing) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `SealSend ${pricing.name} — "${eventTitle}"`,
          description: `Premium invitation for up to ${pricing.guests} guests. No branding, premium templates, SMS + email.`,
        },
        unit_amount: pricing.amount,
      },
      quantity: 1,
    }],
    metadata: { eventId, tier: resolvedTier, userId },
    success_url: `${siteUrl}/events/${eventId}?upgraded=true`,
    cancel_url: `${siteUrl}/events/${eventId}`,
    payment_intent_data: {
      metadata: { eventId, tier: resolvedTier, userId },
      description: `${pricing.name} upgrade for "${eventTitle}"`,
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return session.url;
}

// Pro annual subscription checkout
export async function createProCheckoutSession({
  userId,
}: {
  userId: string;
}): Promise<string> {
  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: "SealSend Pro — Annual",
          description: "Unlimited premium events, up to 2,500 guests per event, all features included.",
        },
        unit_amount: 12499,
        recurring: { interval: "year" },
      },
      quantity: 1,
    }],
    metadata: { userId, plan: "pro_annual" },
    success_url: `${siteUrl}/dashboard?upgraded=true`,
    cancel_url: `${siteUrl}/pricing`,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return session.url;
}
