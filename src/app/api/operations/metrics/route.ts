import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { isOperationsAuthorized } from "@/lib/operations-auth";
import { computeBetaCohortMetrics, type BetaCohortParticipant } from "@/lib/beta-metrics";
import { BETA_MILESTONE_NAMES, type BetaMilestoneName, type BetaSegment } from "@/lib/beta-participation";
import type { BetaWillingnessToPay } from "@/lib/beta-outcome";
import { evaluateBetaAcceptance } from "@/lib/beta-acceptance-decision";
import betaAcceptancePolicy from "../../../../../config/beta-acceptance-policy.json";

export async function GET(request: NextRequest) {
  if (!isOperationsAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [totals, funnel, deliveries, alerts, betaParticipantRows, betaMilestoneRows, betaFeedbackRows, betaOutcomeRows, betaDefectReviewRows, betaSupportReviewRows] = await Promise.all([
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
       WHERE cohort_version = $1 AND withdrawn_at IS NULL ORDER BY consented_at ASC`,
      [betaAcceptancePolicy.cohortVersion],
    ),
    query<{ participant_id: string; event_name: BetaMilestoneName; created_at: string }>(
      `SELECT participants.user_id::text AS participant_id, events.event_name, events.created_at
       FROM beta_participants participants
       JOIN activation_events events
         ON events.user_id = participants.user_id AND events.created_at >= participants.consented_at
       WHERE participants.cohort_version = $1
         AND participants.withdrawn_at IS NULL AND events.event_name = ANY($2::text[])
       ORDER BY participants.user_id, events.created_at`,
      [betaAcceptancePolicy.cohortVersion, BETA_MILESTONE_NAMES],
    ),
    query<{ participant_id: string; rating: number }>(
      `SELECT participants.user_id::text AS participant_id, feedback.rating
       FROM beta_participants participants
       JOIN beta_feedback feedback
         ON feedback.user_id = participants.user_id AND feedback.created_at >= participants.consented_at
       WHERE participants.cohort_version = $1 AND participants.withdrawn_at IS NULL
      ORDER BY participants.user_id, feedback.created_at`,
      [betaAcceptancePolicy.cohortVersion],
    ),
    query<{ participant_id: string; willingness_to_pay: BetaWillingnessToPay; repeat_intent: number; self_reported_support_minutes: number }>(
      `SELECT participants.user_id::text AS participant_id,
              outcomes.willingness_to_pay,
              outcomes.repeat_intent,
              outcomes.self_reported_support_minutes
       FROM beta_participants participants
       JOIN beta_outcomes outcomes
         ON outcomes.user_id = participants.user_id AND outcomes.consented_at = participants.consented_at
       WHERE participants.cohort_version = $1 AND participants.withdrawn_at IS NULL
      ORDER BY participants.user_id`,
      [betaAcceptancePolicy.cohortVersion],
    ),
    query<{ participant_id: string; unresolved_severity_1: number; unresolved_severity_2: number }>(
      `SELECT participants.user_id::text AS participant_id,
              reviews.unresolved_severity_1,
              reviews.unresolved_severity_2
         FROM beta_participants participants
         JOIN beta_defect_reviews reviews
           ON reviews.user_id = participants.user_id AND reviews.consented_at = participants.consented_at
        WHERE participants.cohort_version = $1 AND participants.withdrawn_at IS NULL
      ORDER BY participants.user_id`,
      [betaAcceptancePolicy.cohortVersion],
    ),
    query<{ participant_id: string; operator_recorded_support_minutes: number }>(
      `SELECT participants.user_id::text AS participant_id,
              reviews.operator_recorded_support_minutes
         FROM beta_participants participants
         JOIN beta_support_reviews reviews
           ON reviews.user_id = participants.user_id AND reviews.consented_at = participants.consented_at
        WHERE participants.cohort_version = $1 AND participants.withdrawn_at IS NULL
        ORDER BY participants.user_id`,
      [betaAcceptancePolicy.cohortVersion],
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
      outcome: null,
      defectReview: null,
      supportReview: null,
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
  for (const outcome of betaOutcomeRows) {
    const participant = participantMap.get(outcome.participant_id);
    if (participant) participant.outcome = {
      willingnessToPay: outcome.willingness_to_pay,
      repeatIntent: outcome.repeat_intent,
      selfReportedSupportMinutes: outcome.self_reported_support_minutes,
    };
  }
  for (const review of betaDefectReviewRows) {
    const participant = participantMap.get(review.participant_id);
    if (participant) participant.defectReview = {
      unresolvedSeverity1: review.unresolved_severity_1,
      unresolvedSeverity2: review.unresolved_severity_2,
    };
  }
  for (const review of betaSupportReviewRows) {
    const participant = participantMap.get(review.participant_id);
    if (participant) participant.supportReview = {
      operatorRecordedSupportMinutes: review.operator_recorded_support_minutes,
    };
  }
  const betaCohort = computeBetaCohortMetrics([...participantMap.values()]);
  const betaAcceptance = evaluateBetaAcceptance({
    policy: betaAcceptancePolicy,
    metrics: betaCohort,
    cohortStartedAt: betaParticipantRows[0]?.consented_at ?? null,
  });
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
    { generatedAt: new Date().toISOString(), periodDays: 30, totals, funnel, deliveries, alerts, betaParticipants, betaMilestones, betaCohort, betaAcceptance },
    { headers: { "Cache-Control": "no-store" } },
  );
}
