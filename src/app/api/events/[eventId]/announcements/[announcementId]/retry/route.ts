import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { getDb } from "@/lib/db/client";
import { dispatchAnnouncement } from "@/lib/messages/dispatch-announcement";

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string; announcementId: string }> }) {
  const { eventId, announcementId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "send_messages")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!z.object({ approved: z.literal(true) }).strict().safeParse(await request.json()).success) return NextResponse.json({ error: "Explicit approval is required" }, { status: 400 });
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const announcement = await client.query(
      `UPDATE event_announcements SET status = 'queued', scheduled_at = NOW(), approved_at = NOW(), last_error = NULL
       WHERE id = $1 AND event_id = $2 AND status IN ('failed','partially_failed') RETURNING id`, [announcementId, eventId],
    );
    if (!announcement.rows[0]) { await client.query("ROLLBACK"); return NextResponse.json({ error: "No failed deliveries are retryable" }, { status: 409 }); }
    await client.query(
      `UPDATE announcement_deliveries SET status = 'queued', error = NULL, updated_at = NOW()
       WHERE announcement_id = $1 AND status IN ('failed','bounced')`, [announcementId],
    );
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  return NextResponse.json(await dispatchAnnouncement(announcementId));
}
