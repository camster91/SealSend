import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { queryOne } from "@/lib/db/client";

export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string; announcementId: string }> }) {
  const { eventId, announcementId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "send_messages")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cancelled = await queryOne(
    `UPDATE event_announcements SET status = 'cancelled'
     WHERE id = $1 AND event_id = $2 AND status = 'queued' RETURNING id, status`,
    [announcementId, eventId],
  );
  if (!cancelled) return NextResponse.json({ error: "Only queued announcements can be cancelled" }, { status: 409 });
  return NextResponse.json(cancelled);
}
