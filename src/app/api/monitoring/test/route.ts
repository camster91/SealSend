import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { captureServerError } from "@/lib/monitoring/server-errors";

function matches(value: string, expected: string) {
  const a = Buffer.from(value); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function POST(request: Request) {
  const secret = process.env.MONITORING_TEST_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 32 || !matches(supplied, secret)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await captureServerError(new Error("SyntheticMonitoringError"), { route: "/api/monitoring/test", method: "POST", routerKind: "App Router", routeType: "route" });
  return NextResponse.json({ captured: true });
}
