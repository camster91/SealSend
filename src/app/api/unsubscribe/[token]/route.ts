import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { handleUnsubscribe } from "@/lib/unsubscribe";

type RouteParams = { params: Promise<{ token: string }> };

/**
 * One-click unsubscribe. Called by the /unsubscribe/[token] page and by mail
 * providers following the List-Unsubscribe header (RFC 8058: a form-encoded
 * `List-Unsubscribe=One-Click` body with no Origin). The signed token is the
 * only authorization, so the proxy exempts this path from its Origin check.
 * The body is ignored: both callers mean the same thing.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  try {
    const { success } = await rateLimit(`unsubscribe:${getClientIp(request)}`, { max: 20, windowSeconds: 60 });
    if (!success) {
      return NextResponse.json({ ok: false, error: "Too many tries. Please wait a minute and try again." }, { status: 429 });
    }
    const result = await handleUnsubscribe(token, getDb());
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[UNSUBSCRIBE] failed to record opt-out", error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/** A mail client that opens the header link in a browser lands on the confirmation page instead. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL || request.url;
  return NextResponse.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, base), 303);
}
