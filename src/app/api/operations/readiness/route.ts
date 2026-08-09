import { NextRequest, NextResponse } from "next/server";
import { isOperationsAuthorized } from "@/lib/operations-auth";
import { getProviderReadiness } from "@/lib/provider-readiness";

export async function GET(request: NextRequest) {
  if (!isOperationsAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), ...getProviderReadiness() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
