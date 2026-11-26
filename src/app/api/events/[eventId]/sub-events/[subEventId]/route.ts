import { NextResponse } from "next/server";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { batch, query } from "@/lib/db/client";
import { deleteSubEvent, subEventUpdateSchema, updateSubEvent } from "@/lib/sub-events";

type RouteParams = { params: Promise<{ eventId: string; subEventId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { eventId, subEventId } = await params;
    const auth = await requireEventPermission(eventId, "edit_event");
    if (auth.error) return auth.error;
    const parsed = subEventUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sub-event", details: parsed.error.flatten() }, { status: 400 });
    }
    if (parsed.data.starts_at && parsed.data.ends_at && Date.parse(parsed.data.ends_at) < Date.parse(parsed.data.starts_at)) {
      return NextResponse.json({ error: "The end time must be after the start time." }, { status: 400 });
    }
    const updated = await updateSubEvent({ query, batch }, eventId, subEventId, parsed.data);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { eventId, subEventId } = await params;
    const auth = await requireEventPermission(eventId, "edit_event");
    if (auth.error) return auth.error;
    const deleted = await deleteSubEvent({ query }, eventId, subEventId);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
