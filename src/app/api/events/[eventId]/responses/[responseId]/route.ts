import { NextResponse } from "next/server";
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { batch } from "@/lib/db/client";
import { deleteRsvp } from '@/lib/rsvp-store';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; responseId: string }> }
) {
  try {
    const { eventId, responseId } = await params;
    const auth = await requireEventPermission(eventId, 'edit_event');
    if (auth.error) return auth.error;

    // deleteRsvp writes in one atomic batch.
    await deleteRsvp({ batch }, eventId, responseId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
