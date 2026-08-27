import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { isOperationsAuthorized } from "@/lib/operations-auth";
import { computeBetaCohortMetrics, type BetaCohortParticipant } from "@/lib/beta-metrics";
import { BETA_MILESTONE_NAMES, type BetaMilestoneName, type BetaSegment } from "@/lib/beta-participation";

export async function GET(request: NextRequest) {
  if (!isOperationsAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [totals, funnel, deliveries, alerts, betaParticipantRows, betaMilestoneRows, betaFeedbackRows] = await Promise.all([
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
    query<{ participant_id: string; segment: BetaSegment; consented_at: string }>(
      `SELECT user_id::text AS participant_id, segment, consented_at FROM beta_participants
       WHERE withdrawn_at IS NULL ORDER BY consented_at ASC`,
    ),
    query<{ participant_id: string; event_name: BetaMilestoneName; created_at: string }>(
      `SELECT participants.user_id::text AS participant_id, events.event_name, events.created_at
       FROM beta_participants participants
       JOIN activation_events events
         ON events.user_id = participants.user_id AND events.created_at >= participants.consented_at
       WHERE participants.withdrawn_at IS NULL AND events.event_name = ANY($1::text[])
       ORDER BY participants.user_id, events.created_at`,
      [BETA_MILESTONE_NAMES],
    ),
    query<{ participant_id: string; rating: number }>(
      `SELECT participants.user_id::text AS participant_id, feedback.rating
       FROM beta_participants participants
       JOIN beta_feedback feedback
         ON feedback.user_id = participants.user_id AND feedback.created_at >= participants.consented_at
       WHERE participants.withdrawn_at IS NULL
       ORDER BY participants.user_id, feedback.created_at`,
    ),
  ]);
  const participantMap = new Map<string, BetaCohortParticipant>(
    betaParticipantRows.map((participant) => [participant.participant_id, {
      participantId: participant.participant_id,
      segment: participant.segment,
      consentedAt: participant.consented_at,
      withdrawnAt: null,
      activationEvents: [],
      feedbackRatings: [],
    }]),
  );
  for (const event of betaMilestoneRows) {
    participantMap.get(event.participant_id)?.activationEvents.push({
      name: event.event_name,
      createdAt: event.created_at,
    });
  }
  for (const feedback of betaFeedbackRows) {
    participantMap.get(feedback.participant_id)?.feedbackRatings.push(feedback.rating);
  }
  const betaCohort = computeBetaCohortMetrics([...participantMap.values()]);
  const betaParticipants = [...betaParticipantRows.reduce((counts, participant) => {
    counts.set(participant.segment, (counts.get(participant.segment) ?? 0) + 1);
    return counts;
  }, new Map<BetaSegment, number>())].map(([segment, count]) => ({ segment, count }));
  const milestoneParticipants = new Map<BetaMilestoneName, Set<string>>();
  for (const event of betaMilestoneRows) {
    if (!milestoneParticipants.has(event.event_name)) milestoneParticipants.set(event.event_name, new Set());
    milestoneParticipants.get(event.event_name)?.add(event.participant_id);
  }
  const betaMilestones = [...milestoneParticipants].map(([eventName, participantIds]) => ({
    eventName,
    participantCount: participantIds.size,
  }));
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), periodDays: 30, totals, funnel, deliveries, alerts, betaParticipants, betaMilestones, betaCohort },
    { headers: { "Cache-Control": "no-store" } },
  );
}
