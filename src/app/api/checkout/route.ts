import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { prisma } from '@/lib/db';
import { createCheckoutSession } from "@/lib/stripe";
import { z } from "zod";

const checkoutSchema = z.object({
  eventId: z.string().uuid(),
  tier: z.enum(["silver", "gold", "platinum", "diamond", "standard", "premium"]),
});

const TIER_RANK: Record<string, number> = {
  free: 0,
  silver: 1,
  standard: 1,
  gold: 2,
  premium: 2,
  platinum: 3,
  diamond: 4,
};

export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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
    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true, title: true, tier: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Verify event is on a lower tier
    const currentRank = TIER_RANK[event.tier] ?? 0;
    const targetRank = TIER_RANK[tier] ?? 0;

    if (targetRank <= currentRank) {
      return NextResponse.json(
        { error: "Event is already on this tier or higher" },
        { status: 400 }
      );
    }

    const url = await createCheckoutSession({
      eventId,
      tier,
      userId: user.id,
      eventTitle: event.title,
    });

    return NextResponse.json({ url });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
