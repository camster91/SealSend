import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { batch, queryOne } from "@/lib/db/client";
import { SQL_NOW } from "@/lib/db/sqlite-dialect";

// A route handler, not a page: pages cannot set cookies while they render.

function appUrl(request: NextRequest, path: string) {
  return new URL(path, process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.url);
}

function redirectTo(request: NextRequest, path: string) {
  const response = NextResponse.redirect(appUrl(request, path));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const eventSlug = request.nextUrl.searchParams.get("event");
  const invalid = () => redirectTo(request, "/invite/problem");
  if (!token || !eventSlug) return invalid();

  try {
    const guest = await queryOne<{ id: string; name: string; email: string | null; phone: string | null; event_id: string }>(
      `SELECT g.id, g.name, g.email, g.phone, g.event_id
         FROM guests g JOIN events e ON e.id = g.event_id
        WHERE g.invite_token = $1 AND e.slug = $2`,
      [token, eventSlug],
    );
    if (!guest) return invalid();

    const sessionToken = nanoid(32);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await batch([
      {
        text: "INSERT INTO user_sessions (user_id, user_role, session_token, expires_at) VALUES ($1, 'guest', $2, $3)",
        params: [guest.id, sessionToken, expires],
      },
      { text: `UPDATE guests SET invite_status = 'accepted', updated_at = ${SQL_NOW} WHERE id = $1`, params: [guest.id] },
    ]);

    const response = redirectTo(request, `/e/${encodeURIComponent(eventSlug)}?t=${encodeURIComponent(token)}`);
    const cookie = { secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires };
    response.cookies.set("sealsend_session", sessionToken, { ...cookie, httpOnly: true });
    response.cookies.set(
      "sealsend_user",
      JSON.stringify({ email: guest.email, phone: guest.phone, role: "guest", eventId: guest.event_id, name: guest.name }),
      cookie,
    );
    return response;
  } catch (error) {
    console.error("Invite link failed:", error);
    return redirectTo(request, "/invite/problem");
  }
}
