import { NextResponse } from "next/server";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { batch, query } from "@/lib/db/client";
import { createSubEvent, listHostSubEvents, subEventCreateSchema } from "@/lib/sub-events";

type RouteParams = { params: Promise<{ eventId: string }> };
const MAX_SUB_EVENTS = 20;

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const auth = await requireEventPermission(eventId, "view_event");
    if (auth.error) return auth.error;
    const subEvents = await listHostSubEvents({ query }, eventId);
    return NextResponse.json(subEvents, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const auth = await requireEventPermission(eventId, "edit_event");
    if (auth.error) return auth.error;
    const parsed = subEventCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sub-event", details: parsed.error.flatten() }, { status: 400 });
    }
    if (parsed.data.starts_at && parsed.data.ends_at && Date.parse(parsed.data.ends_at) < Date.parse(parsed.data.starts_at)) {
      return NextResponse.json({ error: "The end time must be after the start time." }, { status: 400 });
    }
    const [{ count }] = await query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM event_sub_events WHERE event_id = $1",
      [eventId],
    );
    if (Number(count) >= MAX_SUB_EVENTS) {
      return NextResponse.json({ error: `An event can have at most ${MAX_SUB_EVENTS} sub-events.` }, { status: 400 });
    }
    const created = await createSubEvent({ query, batch }, eventId, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
