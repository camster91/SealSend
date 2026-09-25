import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { queryOne } from "@/lib/db/client";
import { isStripeKeyAllowed } from "@/lib/billing";
import { createSmsTopUpCheckoutSession } from "@/lib/stripe";
import { isSmsMetered } from "@/lib/sms-allowance";
import { getUserTier } from "@/lib/subscription";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { BETA_MODE } from "@/lib/constants";

const topUpSchema = z.object({ eventId: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const parsed = topUpSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    const { eventId } = parsed.data;

    const auth = await requireEventPermission(eventId, "manage_billing");
    if (auth.error) return auth.error;
    const user = auth.user;

    const { rateLimit } = await import("@/lib/rate-limit");
    const { success } = await rateLimit(`checkout:${user.id}`, { max: 10, windowSeconds: 3600 });
    if (!success) {
      return NextResponse.json({ error: "Too many checkout attempts. Please try again later." }, { status: 429 });
    }

    if (BETA_MODE) {
      return NextResponse.json({ error: "Paid checkout is disabled during the controlled beta" }, { status: 403 });
    }

    const event = await queryOne<{ title: string; tier: string; user_id: string }>(
      "SELECT title, tier, user_id FROM events WHERE id = $1",
      [eventId],
    );
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    if (!isSmsMetered(await getUserTier(event.user_id), event.tier)) {
      return NextResponse.json({ error: "SMS top-ups are only needed for Event Pass events" }, { status: 400 });
    }

    if (!isStripeKeyAllowed()) {
      return NextResponse.json({ error: "Test billing is not configured" }, { status: 503 });
    }

    const url = await createSmsTopUpCheckoutSession({ eventId, userId: user.id, eventTitle: event.title });
    await recordActivationEventSafely({ name: "checkout_started", userId: user.id, eventId, metadata: { plan: "sms_top_up" } });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
