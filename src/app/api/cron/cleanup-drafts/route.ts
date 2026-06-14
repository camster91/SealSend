import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[CRON] CRON_SECRET environment variable not set");
      return NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const deleted = await query<{ id: string }>(
      'DELETE FROM events WHERE status = $1 AND created_at < $2 RETURNING id',
      ["draft", thirtyDaysAgo]
    );

    return NextResponse.json({ deleted: deleted?.length || 0 });
  } catch (_error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
