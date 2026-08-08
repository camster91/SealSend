import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { dispatchAnnouncement } from "@/lib/messages/dispatch-announcement";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const client = await getDb().connect();
  let ids: string[] = [];
  try {
    await client.query("BEGIN");
    ids = (await client.query<{ id: string }>(
      `SELECT id FROM event_announcements
       WHERE status = 'queued' AND approved_at IS NOT NULL AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC LIMIT 25 FOR UPDATE SKIP LOCKED`,
    )).rows.map((row) => row.id);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  const results = [];
  for (const id of ids) results.push(await dispatchAnnouncement(id));
  return NextResponse.json({ checked: ids.length, dispatched: results.filter((result) => result.dispatched).length, results });
}

export const POST = GET;
