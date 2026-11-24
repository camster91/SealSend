import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { batch, queryOne } from "@/lib/db/client";
import { getEffectiveEventLimits, type EventTier } from "@/lib/entitlements";
import { addReplyAsGuest, matchReplyToGuest } from "@/lib/rsvp-match";
import { getUserTier } from "@/lib/subscription";

const bodySchema = z.union([
  z.object({ guestId: z.string().uuid() }).strict(),
  z.object({ addGuest: z.literal(true) }).strict(),
]);

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string; responseId: string }> }) {
  try {
    const { eventId, responseId } = await params;
    const auth = await requireEventPermission(eventId, "manage_guests");
    if (auth.error) return auth.error;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const input = { eventId, responseId, actorId: auth.user.id };
    let problem: string | null;
    if ("guestId" in parsed.data) {
      problem = await matchReplyToGuest({ batch }, input, parsed.data.guestId);
    } else {
      const event = await queryOne<{ user_id: string; tier: string }>("SELECT user_id, tier FROM events WHERE id = $1", [eventId]);
      if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const limit = getEffectiveEventLimits(await getUserTier(event.user_id), event.tier as EventTier).guests;
      problem = await addReplyAsGuest({ batch }, input, limit);
    }
    if (problem) return NextResponse.json({ error: problem }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
