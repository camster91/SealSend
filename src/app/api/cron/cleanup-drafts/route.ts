import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";

import { timingSafeEqual } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    // Security: Fail securely if the secret is not configured to prevent a "Bearer undefined" bypass.
    if (!cronSecret) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    const expectedHeader = `Bearer ${cronSecret}`;

    // Security: Use timingSafeEqual to prevent timing attacks when comparing the secret.
    const headerBuffer = Buffer.from(authHeader || "");
    const expectedBuffer = Buffer.from(expectedHeader);

    if (
      !authHeader ||
      headerBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(headerBuffer, expectedBuffer)
    ) {
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
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
