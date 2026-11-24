import { NextResponse } from "next/server";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { query } from "@/lib/db/client";
import { listUnmatchedReplies } from "@/lib/rsvp-match";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const auth = await requireEventPermission(eventId, "manage_guests");
    if (auth.error) return auth.error;
    return NextResponse.json(await listUnmatchedReplies({ query }, eventId), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
