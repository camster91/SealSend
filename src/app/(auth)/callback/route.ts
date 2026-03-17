import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const rawNext = searchParams.get("next") ?? "/dashboard";
  // Prevent open redirect: only allow relative paths without protocol
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes(":")
    ? rawNext
    : "/dashboard";

  // The old Supabase OAuth callback flow is no longer used.
  // Auth is now handled via /api/auth/send-code and /api/auth/verify-code.
  // Redirect to the intended destination or login page.
  return NextResponse.redirect(`${origin}${next}`);
}
