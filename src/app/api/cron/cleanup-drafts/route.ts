import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";

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

    const configuredDays = Number(process.env.STALE_DRAFT_RETENTION_DAYS || "90");
    const retentionDays = Number.isFinite(configuredDays) ? Math.max(30, Math.floor(configuredDays)) : 90;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const enabled = process.env.ENABLE_STALE_DRAFT_CLEANUP === "true";

    if (!enabled) {
      const candidates = await query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM events WHERE status = $1 AND updated_at < $2',
        ["draft", cutoff],
      );
      return NextResponse.json({ enabled: false, retentionDays, candidates: Number(candidates[0]?.count ?? 0), deleted: 0 });
    }

    const deleted = await query<{ id: string }>(
      'DELETE FROM events WHERE status = $1 AND updated_at < $2 RETURNING id',
      ["draft", cutoff]
    );

    return NextResponse.json({ enabled: true, retentionDays, deleted: deleted?.length || 0 });
  } catch (error) {
    console.error("[cleanup-drafts] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const POST = GET;
