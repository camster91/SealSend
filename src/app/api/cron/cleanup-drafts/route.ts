import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const deleted = await query<{ id: string }>(
      'DELETE FROM events WHERE status = $1 AND created_at < $2 RETURNING id',
      ["draft", thirtyDaysAgo]
    );

    return NextResponse.json({ deleted: deleted?.length || 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
