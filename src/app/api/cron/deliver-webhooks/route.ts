import { NextRequest, NextResponse } from "next/server";
import { deliverDueWebhooks } from "@/lib/webhooks";

/** Delivers due workspace webhooks and schedules retries. Call every minute from the scheduler. */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[deliver-webhooks] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await deliverDueWebhooks();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export const POST = GET;
