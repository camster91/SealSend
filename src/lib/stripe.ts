import Stripe from "stripe";
import { EVENT_PASS, SMS_TOP_UP } from "@/lib/constants";

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

// Per-event pricing. Only the Event Pass is sold; legacy one-time tiers keep
// working for events that already bought them (see src/lib/entitlements.ts).
export async function createCheckoutSession({
  eventId,
  userId,
  eventTitle,
}: {
  eventId: string;
  userId: string;
  eventTitle: string;
}): Promise<string> {
  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
  const tier = "event_pass";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `SealSend ${EVENT_PASS.name} — "${eventTitle}"`,
          description: `One event for up to ${EVENT_PASS.guestsPerEvent} guests: email and SMS invitations, guest tags, announcements, sign-up board, analytics, co-hosts, and no SealSend badge.`,
        },
        unit_amount: EVENT_PASS.priceCents,
      },
      quantity: 1,
    }],
    metadata: { eventId, tier, userId },
    success_url: `${siteUrl}/events/${eventId}?upgraded=true`,
    cancel_url: `${siteUrl}/events/${eventId}`,
    payment_intent_data: {
      metadata: { eventId, tier, userId },
      description: `${EVENT_PASS.name} for "${eventTitle}"`,
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return session.url;
}

// SMS top-up for an Event Pass event that has used its included segments.
export async function createSmsTopUpCheckoutSession({
  eventId,
  userId,
  eventTitle,
}: {
  eventId: string;
  userId: string;
  eventTitle: string;
}): Promise<string> {
  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
  const metadata = { eventId, userId, kind: "sms_top_up", segments: String(SMS_TOP_UP.segments) };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `SealSend SMS top-up — "${eventTitle}"`,
          description: `${SMS_TOP_UP.segments} additional SMS segments for this event.`,
        },
        unit_amount: SMS_TOP_UP.priceCents,
      },
      quantity: 1,
    }],
    metadata,
    success_url: `${siteUrl}/events/${eventId}?sms_top_up=true`,
    cancel_url: `${siteUrl}/events/${eventId}`,
    payment_intent_data: { metadata, description: `SMS top-up for "${eventTitle}"` },
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
