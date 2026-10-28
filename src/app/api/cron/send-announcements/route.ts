import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { SQL_NOW } from "@/lib/db/sqlite-dialect";
import { dispatchAnnouncement } from "@/lib/messages/dispatch-announcement";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only a candidate list: dispatchAnnouncement claims each one atomically, so an
  // overlapping run that picks the same ids skips the ones it loses.
  const ids = (await query<{ id: string }>(
    `SELECT id FROM event_announcements
     WHERE status = 'queued' AND approved_at IS NOT NULL AND scheduled_at <= ${SQL_NOW}
     ORDER BY scheduled_at ASC LIMIT 25`,
  )).map((row) => row.id);
  const results = [];
  for (const id of ids) results.push(await dispatchAnnouncement(id));
  return NextResponse.json({ checked: ids.length, dispatched: results.filter((result) => result.dispatched).length, results });
}

export const POST = GET;
