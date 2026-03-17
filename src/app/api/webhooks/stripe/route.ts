import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/db';
import { TIERS } from "@/lib/constants";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { eventId, tier } = session.metadata || {};

    if (!eventId || !tier) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const tierKey = tier as keyof typeof TIERS;
    if (tierKey !== "standard" && tierKey !== "premium") {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const maxResponses = TIERS[tierKey].maxResponses;

    try {
      await prisma.event.update({
        where: { id: eventId },
        data: {
          tier: tierKey,
          max_responses: maxResponses,
          payment_id: session.id,
        },
      });
    } catch (error) {
      console.error("Failed to update event after payment:", error);
      return NextResponse.json(
        { error: "Failed to update event" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
