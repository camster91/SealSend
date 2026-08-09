import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  const secret = process.env.OPERATIONS_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [totals, funnel, deliveries] = await Promise.all([
    queryOne<Record<string, string>>(
      `SELECT
        (SELECT COUNT(*) FROM admin_users)::text AS accounts,
        (SELECT COUNT(*) FROM events)::text AS events,
        (SELECT COUNT(*) FROM events WHERE status = 'published')::text AS published_events,
        (SELECT COUNT(*) FROM rsvp_responses)::text AS responses,
        (SELECT COUNT(*) FROM account_deletion_requests WHERE status = 'pending')::text AS pending_deletions,
        (SELECT COALESCE(SUM(byte_size), 0) FROM upload_assets)::text AS storage_bytes,
        (SELECT COUNT(*) FROM server_error_events WHERE created_at >= NOW() - INTERVAL '24 hours')::text AS errors_24h`,
    ),
    query<{ event_name: string; count: string }>(
      `SELECT event_name, COUNT(*)::text AS count FROM activation_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY event_name ORDER BY event_name`,
    ),
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM announcement_deliveries
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY status ORDER BY status`,
    ),
  ]);
  return NextResponse.json({ generatedAt: new Date().toISOString(), periodDays: 30, totals, funnel, deliveries }, { headers: { "Cache-Control": "no-store" } });
}
