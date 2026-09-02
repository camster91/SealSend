import { NextResponse } from "next/server";

import { requireEventPermission } from "@/lib/auth/event-api-access";
import { queryOne } from "@/lib/db/client";
import { canUseFeature, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { eventId } = await params;
  const auth = await requireEventPermission(eventId, "export_responses");
  if (auth.error) return auth.error;

  const event = await queryOne<{ user_id: string; tier: string }>(
    "SELECT user_id, tier FROM events WHERE id = $1",
    [eventId],
  );
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const accountPlan = await getUserTier(event.user_id);
  return NextResponse.json(
    { analytics: canUseFeature(accountPlan, event.tier as EventTier, "analytics") },
    { headers: { "Cache-Control": "no-store" } },
  );
}
