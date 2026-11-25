import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { isAuthorizedCron } from "@/lib/auth/cron-auth";
import { sqlNowPlus } from "@/lib/db/sqlite-dialect";
import { sendEmail } from "@/lib/email";
import { buildHostLifecycleMessage, type HostLifecycleCandidate } from "@/lib/host-lifecycle";
import { resolveStaleDraftPolicy } from "@/lib/retention";
import { communicationSuppressionKey } from "@/lib/communication-suppressions";

const ELIGIBLE_HOST_SQL = `a.email_verified_at IS NOT NULL AND LOWER(a.email) NOT LIKE '%@users.sealsend.local'`;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { retentionDays, warningAgeDays } = resolveStaleDraftPolicy(
    process.env.STALE_DRAFT_RETENTION_DAYS,
    process.env.STALE_DRAFT_WARNING_DAYS,
  );
  const day = 24 * 60 * 60 * 1000;
  const warnFrom = new Date(Date.now() - warningAgeDays * day);
  const retentionCutoff = new Date(Date.now() - retentionDays * day);
  // The stale-draft scope key's epoch is whole seconds of updated_at, rounded like Postgres
  // EXTRACT(EPOCH ...)::bigint so keys written before the move to D1 still match. cleanup-drafts
  // builds the same key.
  const candidates = await query<HostLifecycleCandidate>(
    `SELECT * FROM (
      SELECT a.id AS user_id, a.email, NULL AS event_id, NULL AS title,
             'getting_started' AS notification_type, 'getting_started:' || a.id AS scope_key,
             NULL AS action_at
        FROM admin_users a
       WHERE ${ELIGIBLE_HOST_SQL}
         AND a.created_at < ${sqlNowPlus("-24 hours")}
         AND NOT EXISTS (SELECT 1 FROM events e WHERE e.user_id = a.id)
      UNION ALL
      SELECT a.id, a.email, e.id, e.title, 'finish_draft', 'finish_draft:' || e.id, NULL
        FROM admin_users a JOIN events e ON e.user_id = a.id
       WHERE ${ELIGIBLE_HOST_SQL}
         AND e.status = 'draft' AND e.updated_at < ${sqlNowPlus("-48 hours")}
      UNION ALL
      SELECT a.id, a.email, e.id, e.title, 'event_approaching', 'event_approaching:' || e.id, NULL
        FROM admin_users a JOIN events e ON e.user_id = a.id
       WHERE ${ELIGIBLE_HOST_SQL}
         AND e.status = 'published' AND e.event_date > ${sqlNowPlus("+2 days")}
         AND e.event_date <= ${sqlNowPlus("+3 days")}
      UNION ALL
      SELECT a.id, a.email, e.id, e.title, 'post_event_repeat', 'post_event_repeat:' || e.id, NULL
        FROM admin_users a JOIN events e ON e.user_id = a.id
       WHERE ${ELIGIBLE_HOST_SQL}
         AND e.status = 'published'
         AND COALESCE(e.event_end_date, e.event_date) <= ${sqlNowPlus("-24 hours")}
         AND COALESCE(e.event_end_date, e.event_date) >= ${sqlNowPlus("-7 days")}
         AND EXISTS (SELECT 1 FROM rsvp_responses responses WHERE responses.event_id = e.id)
         AND NOT EXISTS (
           SELECT 1 FROM events repeated WHERE repeated.repeated_from_event_id = e.id
         )
      UNION ALL
      SELECT a.id, a.email, e.id, e.title, 'stale_draft_warning',
             'stale_draft_warning:' || e.id || ':' || CAST(round(unixepoch(e.updated_at, 'subsec')) AS INTEGER) || ':' || $2,
             strftime('%Y-%m-%dT%H:%M:%fZ', e.updated_at, '+' || $2 || ' days') AS action_at
        FROM admin_users a JOIN events e ON e.user_id = a.id
       WHERE ${ELIGIBLE_HOST_SQL}
         AND e.status = 'draft'
         AND e.updated_at <= $1
         AND e.updated_at > $3
    ) c WHERE NOT EXISTS (SELECT 1 FROM host_lifecycle_notifications n WHERE n.scope_key = c.scope_key)
    ORDER BY notification_type, scope_key LIMIT 25`,
    [warnFrom, retentionDays, retentionCutoff],
  );
  if (process.env.ENABLE_HOST_LIFECYCLE_EMAILS !== "true") {
    return NextResponse.json({ enabled: false, candidates: candidates.length, sent: 0 });
  }
  let sent = 0;
  let failed = 0;
  for (const candidate of candidates) {
    // Honor email suppressions/opt-outs before claiming or sending.
    const [, recipientHash] = communicationSuppressionKey("email", candidate.email).split(":");
    const suppressed = await query(
      "SELECT 1 FROM communication_suppressions WHERE channel = 'email' AND recipient_hash = $1 LIMIT 1",
      [recipientHash],
    );
    if (suppressed.length > 0) continue;

    // Claim scope_key atomically before sending so overlapping cron runs never duplicate.
    const claimed = await query<{ id: string }>(
      `INSERT INTO host_lifecycle_notifications (user_id, event_id, notification_type, scope_key)
       VALUES ($1, $2, $3, $4) ON CONFLICT (scope_key) DO NOTHING RETURNING id`,
      [candidate.user_id, candidate.event_id, candidate.notification_type, candidate.scope_key],
    );
    if (!claimed[0]) continue;

    try {
      const message = buildHostLifecycleMessage(candidate);
      const result = await sendEmail({ to: candidate.email, ...message });
      await query(
        "UPDATE host_lifecycle_notifications SET provider_message_id = $1 WHERE id = $2",
        [result.id ?? null, claimed[0].id],
      );
      sent += 1;
    } catch (error) {
      // Release claim on failure so transient provider outages can retry next run.
      await query("DELETE FROM host_lifecycle_notifications WHERE id = $1", [claimed[0].id]);
      console.error("[host-lifecycle] Controlled send failed", error);
      failed += 1;
    }
  }
  return NextResponse.json({ enabled: true, candidates: candidates.length, sent, failed });
}

export const POST = GET;
