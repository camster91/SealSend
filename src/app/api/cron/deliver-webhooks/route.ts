import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron-auth";
import { deliverDueWebhooks } from "@/lib/webhooks";

/** Delivers due workspace webhooks and schedules retries. Call every minute from the scheduler. */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[deliver-webhooks] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await deliverDueWebhooks();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export const POST = GET;
