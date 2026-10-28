import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { batch } from "@/lib/db/client";
import { abortCode, guard, SQL_NOW } from "@/lib/db/sqlite-dialect";
import { dispatchAnnouncement } from "@/lib/messages/dispatch-announcement";

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string; announcementId: string }> }) {
  const { eventId, announcementId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "send_messages")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!z.object({ approved: z.literal(true) }).strict().safeParse(await request.json()).success) return NextResponse.json({ error: "Explicit approval is required" }, { status: 400 });
  // One batch: requeue the deliveries only when the announcement itself was retryable.
  try {
    await batch([
      guard(
        "EXISTS (SELECT 1 FROM event_announcements WHERE id = $1 AND event_id = $2 AND status IN ('failed','partially_failed'))",
        [announcementId, eventId],
        "not_retryable",
      ),
      {
        text: `UPDATE event_announcements SET status = 'queued', scheduled_at = ${SQL_NOW}, approved_at = ${SQL_NOW}, last_error = NULL
       WHERE id = $1 AND event_id = $2 AND status IN ('failed','partially_failed')`,
        params: [announcementId, eventId],
      },
      {
        text: `UPDATE announcement_deliveries SET status = 'queued', error = NULL, updated_at = ${SQL_NOW}
       WHERE announcement_id = $1 AND status IN ('failed','bounced')`,
        params: [announcementId],
      },
    ]);
  } catch (error) {
    if (abortCode(error) === "not_retryable") return NextResponse.json({ error: "No failed deliveries are retryable" }, { status: 409 });
    throw error;
  }
  return NextResponse.json(await dispatchAnnouncement(announcementId));
}
