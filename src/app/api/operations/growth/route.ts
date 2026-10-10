import { NextRequest, NextResponse } from "next/server";
import { isOperationsAuthorized } from "@/lib/operations-auth";
import { buildGrowthReport } from "@/lib/analytics/growth-report";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  if (!isOperationsAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }
  try {
    return NextResponse.json(await buildGrowthReport(), { headers });
  } catch {
    return NextResponse.json({ error: "Growth report temporarily unavailable" }, { status: 503, headers });
  }
}
