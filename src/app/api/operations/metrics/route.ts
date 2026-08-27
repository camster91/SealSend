import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { isOperationsAuthorized } from "@/lib/operations-auth";
import { BETA_MILESTONE_NAMES } from "@/lib/beta-participation";

export async function GET(request: NextRequest) {
  if (!isOperationsAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [totals, funnel, deliveries, alerts, betaParticipants, betaMilestones] = await Promise.all([
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
    query<{ status: string; count: string }>(
      `SELECT last_delivery_status AS status, COUNT(*)::text AS count FROM monitoring_alert_deliveries
        WHERE last_attempted_at >= NOW() - INTERVAL '30 days'
        GROUP BY last_delivery_status ORDER BY last_delivery_status`,
    ),
    query<{ segment: string; count: string }>(
      `SELECT segment, COUNT(*)::text AS count FROM beta_participants
       WHERE withdrawn_at IS NULL GROUP BY segment ORDER BY segment`,
    ),
    query<{ event_name: string; participant_count: string }>(
      `SELECT events.event_name, COUNT(DISTINCT participants.user_id)::text AS participant_count
       FROM beta_participants participants
       JOIN activation_events events
         ON events.user_id = participants.user_id AND events.created_at >= participants.consented_at
       WHERE participants.withdrawn_at IS NULL AND events.event_name = ANY($1::text[])
       GROUP BY events.event_name ORDER BY events.event_name`,
      [BETA_MILESTONE_NAMES],
    ),
  ]);
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), periodDays: 30, totals, funnel, deliveries, alerts, betaParticipants, betaMilestones },
    { headers: { "Cache-Control": "no-store" } },
  );
}
