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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const deleted = await query<{ id: string }>(
      'DELETE FROM events WHERE status = $1 AND created_at < $2 RETURNING id',
      ["draft", thirtyDaysAgo]
    );

    return NextResponse.json({ deleted: deleted?.length || 0 });
  } catch (error) {
    console.error("[cleanup-drafts] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
