import { NextRequest, NextResponse } from "next/server";
import { requireApiHost } from '@/lib/auth/api-auth';
import { queryOne } from "@/lib/db/client";
import { createCheckoutSession } from "@/lib/stripe";
import { z } from "zod";
import { isStripeKeyAllowed } from '@/lib/billing';
import { recordActivationEventSafely } from '@/lib/analytics/activation-events';
import { isEventTierUpgrade } from '@/lib/entitlements';

const checkoutSchema = z.object({
  eventId: z.string().uuid(),
  tier: z.literal("event_pass"),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    const { rateLimit } = await import("@/lib/rate-limit");
    const { success: rateLimitOk } = await rateLimit(`checkout:${user.id}`, {
      max: 10,
      windowSeconds: 3600,
    });
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { eventId, tier } = parsed.data;

    // Verify user owns the event
    const event = await queryOne<{ id: string; title: string; tier: string }>(
      'SELECT id, title, tier FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!isStripeKeyAllowed()) {
      return NextResponse.json({ error: "Test billing is not configured" }, { status: 503 });
    }

    // A legacy one-time tier with more capacity than the pass must not be downgraded.
    if (!isEventTierUpgrade(event.tier, tier)) {
      return NextResponse.json(
        { error: "Event already has this capacity or more" },
        { status: 400 }
      );
    }

    const url = await createCheckoutSession({
      eventId,
      userId: user.id,
      eventTitle: event.title,
    });
    await recordActivationEventSafely({ name: 'checkout_started', userId: user.id, eventId, metadata: { plan: tier } });

    return NextResponse.json({ url });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
