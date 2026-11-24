import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { resolveStaleDraftPolicy } from "@/lib/retention";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[cleanup-drafts] CRON_SECRET is not configured");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { retentionDays, warningDays } = resolveStaleDraftPolicy(
      process.env.STALE_DRAFT_RETENTION_DAYS,
      process.env.STALE_DRAFT_WARNING_DAYS,
    );
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const warningCutoff = new Date(Date.now() - warningDays * 24 * 60 * 60 * 1000);
    const enabled = process.env.ENABLE_STALE_DRAFT_CLEANUP === "true";

    // The scope key's epoch is whole seconds of updated_at, rounded like Postgres
    // EXTRACT(EPOCH ...)::bigint so warnings sent before the move to D1 still match.
    // send-host-lifecycle builds the same key.
    const counts = await query<{ candidates: number; warned_candidates: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE events.updated_at < $2) AS candidates,
         COUNT(*) FILTER (
           WHERE events.updated_at < $2
             AND EXISTS (
               SELECT 1 FROM host_lifecycle_notifications notifications
                WHERE notifications.event_id = events.id
                  AND notifications.notification_type = 'stale_draft_warning'
                  AND notifications.scope_key = 'stale_draft_warning:' || events.id || ':' ||
                      CAST(round(unixepoch(events.updated_at, 'subsec')) AS INTEGER) || ':' || $4
                  AND notifications.sent_at <= $3
             )
         ) AS warned_candidates
       FROM events WHERE events.status = $1`,
      ["draft", cutoff, warningCutoff, retentionDays],
    );
    const candidates = Number(counts[0]?.candidates ?? 0);
    const warnedCandidates = Number(counts[0]?.warned_candidates ?? 0);
    const blockedWithoutWarning = Math.max(0, candidates - warnedCandidates);

    if (!enabled) return NextResponse.json({
      enabled: false,
      retentionDays,
      warningDays,
      candidates,
      warnedCandidates,
      blockedWithoutWarning,
      deleted: 0,
    });

    const deleted = await query<{ id: string }>(
      `DELETE FROM events
        WHERE events.status = $1 AND events.updated_at < $2
          AND EXISTS (
            SELECT 1 FROM host_lifecycle_notifications notifications
             WHERE notifications.event_id = events.id
               AND notifications.notification_type = 'stale_draft_warning'
               AND notifications.scope_key = 'stale_draft_warning:' || events.id || ':' ||
                   CAST(round(unixepoch(events.updated_at, 'subsec')) AS INTEGER) || ':' || $4
               AND notifications.sent_at <= $3
          )
        RETURNING id`,
      ["draft", cutoff, warningCutoff, retentionDays],
    );

    return NextResponse.json({
      enabled: true,
      retentionDays,
      warningDays,
      candidates,
      warnedCandidates,
      blockedWithoutWarning,
      deleted: deleted?.length || 0,
    });
  } catch (error) {
    console.error("[cleanup-drafts] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const POST = GET;
