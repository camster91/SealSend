import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { requireEventPermission } from "@/lib/auth/event-api-access";

type RouteParams = { params: Promise<{ eventId: string; shareId: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { eventId, shareId } = await params;
  const auth = await requireEventPermission(eventId, "edit_event");
  if (auth.error) return auth.error;
  if (!/^[0-9a-f-]{36}$/i.test(shareId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const revoked = await query(
    "UPDATE event_client_shares SET revoked_at = NOW() WHERE id = $1 AND event_id = $2 AND revoked_at IS NULL RETURNING id",
    [shareId, eventId],
  );
  if (revoked.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
