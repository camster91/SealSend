import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutSession } from "@/lib/stripe";
import { z } from "zod";

const checkoutSchema = z.object({
  eventId: z.string().uuid(),
  tier: z.enum(["standard", "premium"]),
});

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
    const adminSupabase = createAdminClient();

    // Verify user owns the event
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("id, title, tier")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Verify event is on a lower tier
    const tierRank = { free: 0, standard: 1, premium: 2 } as const;
    const currentRank = tierRank[event.tier as keyof typeof tierRank] ?? 0;
    const targetRank = tierRank[tier];

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
