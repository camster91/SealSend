import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { batch, query, queryOne } from "@/lib/db/client";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getApiUser } from "@/lib/auth/api-auth";
import { isValidMagicToken } from "@/lib/magic-token";
import { findRsvp, RsvpError } from "@/lib/rsvp-store";
import { listVisibleSubEvents, saveSubEventRsvps, subEventRsvpBatchSchema, SubEventError } from "@/lib/sub-events";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie, X-Guest-Token, X-Rsvp-Edit-Token" };
type Context = { params: Promise<{ slug: string }> };
type PublishedEvent = { id: string; slug: string };

async function publishedEvent(slug: string): Promise<PublishedEvent> {
  const event = await queryOne<PublishedEvent>("SELECT id, slug FROM events WHERE slug = $1 AND status = 'published'", [slug]);
  if (!event) throw new RsvpError("Event not found or not published", 404);
  return event;
}

/** Same identity rules as /api/rsvp/[slug]: personal invite token, else a guest session for this event. */
async function resolveGuest(request: Request, eventId: string): Promise<string | null> {
  const token = request.headers.get("x-guest-token");
  if (token !== null) {
    if (!/^[A-Za-z0-9_-]{24}$/.test(token)) throw new RsvpError("Invalid guest access.");
    const guestId = (await queryOne<{ id: string }>("SELECT id FROM guests WHERE event_id = $1 AND invite_token = $2", [eventId, token]))?.id ?? null;
    if (!guestId) throw new RsvpError("Invalid guest access.");
    return guestId;
  }
  const user = await getApiUser();
  if (user?.role !== "guest") return null;
  return (await queryOne<{ id: string }>("SELECT id FROM guests WHERE event_id = $1 AND id = $2", [eventId, user.id]))?.id ?? null;
}

/** Reads (never mints) the edit token the main RSVP route set for public replies. */
async function existingEditToken(request: Request, eventId: string): Promise<string | undefined> {
  const token = request.headers.get("x-rsvp-edit-token") ?? (await cookies()).get(`sealsend_rsvp_${eventId}`)?.value;
  if (!token) return undefined;
  if (!isValidMagicToken(token)) throw new RsvpError("Invalid response access.");
  return token;
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof RsvpError || error instanceof SubEventError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders });
  }
  return NextResponse.json({ error: fallback }, { status: 500, headers: privateHeaders });
}

export async function GET(request: Request, { params }: Context) {
  try {
    const { slug } = await params;
    const limit = await rateLimit(`rsvp-sub-read:${slug}:${getClientIp(request)}`, { max: 60, windowSeconds: 60 });
    if (!limit.success) return NextResponse.json({ error: "Please try again shortly." }, { status: 429, headers: privateHeaders });
    const event = await publishedEvent(slug);
    const guestId = await resolveGuest(request, event.id);
    const editToken = guestId ? undefined : await existingEditToken(request, event.id);
    const response = await findRsvp({ query, batch }, event.id, guestId, editToken);
    const subEvents = await listVisibleSubEvents({ query }, event.id, guestId, response?.id ?? null);
    return NextResponse.json({ sub_events: subEvents, has_response: Boolean(response) }, { headers: privateHeaders });
  } catch (error) {
    return errorResponse(error, "Unable to load the schedule.");
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { slug } = await params;
    const limit = await rateLimit(`rsvp-sub:${slug}:${getClientIp(request)}`, { max: 20, windowSeconds: 300 });
    if (!limit.success) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: privateHeaders });
    const parsed = subEventRsvpBatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid submission" }, { status: 400, headers: privateHeaders });
    const event = await publishedEvent(slug);
    const guestId = await resolveGuest(request, event.id);
    const editToken = guestId ? undefined : await existingEditToken(request, event.id);
    const response = await findRsvp({ query, batch }, event.id, guestId, editToken);
    if (!response) throw new SubEventError("Please submit your main RSVP first.", 400);
    const ids = parsed.data.responses.map((item) => item.sub_event_id);
    if (new Set(ids).size !== ids.length) throw new SubEventError("Each sub-event can only be answered once.", 400);
    const maxHeadcount = Math.max(1, Number(response.headcount) || 1);
    const items = parsed.data.responses.map((item) => ({
      ...item,
      headcount: Math.min(item.headcount ?? maxHeadcount, maxHeadcount),
    }));
    const subEvents = await saveSubEventRsvps({ query, batch }, event.id, response.id, guestId, maxHeadcount, items);
    return NextResponse.json({ success: true, sub_events: subEvents }, { headers: privateHeaders });
  } catch (error) {
    return errorResponse(error, "Unable to save your schedule replies.");
  }
}
