import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { batch, query, queryOne } from "@/lib/db/client";
import { guard } from "@/lib/db/sqlite-dialect";
import { rsvpSubmissionSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/utils";
import type { Event } from "@/types/database";
import { getEffectiveEventLimits, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { enqueueWebhookEvent } from "@/lib/webhooks";
import { getApiUser } from "@/lib/auth/api-auth";
import { generateMagicToken, isValidMagicToken } from "@/lib/magic-token";
import { findRsvp, saveRsvp, RsvpError, RSVP_CHANGED } from "@/lib/rsvp-store";
import { validateRsvpResponseData } from '@/lib/rsvp-fields';
import type { RSVPField } from '@/types/database';

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie, X-Guest-Token, X-Rsvp-Edit-Token" };
type Context = { params: Promise<{ slug: string }> };
// Every field definition that affects validation, as one comparable value.
const rsvpFieldsFingerprintSql = `SELECT json_group_array(json_array(id, field_name, field_label, field_type, options, is_required, is_enabled, sort_order))
  FROM (SELECT * FROM rsvp_fields WHERE event_id = $1 ORDER BY sort_order, id)`;
const editCookieName =(event: Event) => `sealsend_rsvp_${event.id}`;
function setEditCookie(result: NextResponse, event: Event, token: string) {
  result.cookies.set(editCookieName(event), token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: `/api/rsvp/${event.slug}`, maxAge: 365 * 86400,
  });
}
async function publishedEvent(slug: string) {
  const event = await queryOne<Event>("SELECT * FROM events WHERE slug = $1 AND status = 'published'", [slug]);
  if (!event) throw new RsvpError("Event not found or not published", 404);
  return event;
}
async function resolveGuest(request: Request, eventId: string, requestedId?: string): Promise<string | null> {
  const token = request.headers.get("x-guest-token");
  let guestId: string | null = null;
  if (token !== null) {
    if (!/^[A-Za-z0-9_-]{24}$/.test(token)) throw new RsvpError("Invalid guest access.");
    guestId = (await queryOne<{ id: string }>("SELECT id FROM guests WHERE event_id = $1 AND invite_token = $2", [eventId, token]))?.id ?? null;
    if (!guestId) throw new RsvpError("Invalid guest access.");
  } else {
    const user = await getApiUser();
    if (user?.role === "guest") {
      guestId = (await queryOne<{ id: string }>("SELECT id FROM guests WHERE event_id = $1 AND id = $2", [eventId, user.id]))?.id ?? null;
    }
  }
  if (requestedId && requestedId !== guestId) throw new RsvpError("Open your personal invitation to respond as this guest.");
  return guestId;
}
async function resolveEditToken(request: Request, event: Event, supplied?: string) {
  const token = supplied ?? request.headers.get("x-rsvp-edit-token") ?? (await cookies()).get(editCookieName(event))?.value;
  if (token && !isValidMagicToken(token)) throw new RsvpError("Invalid response access.");
  return token || generateMagicToken();
}

export async function GET(request: Request, { params }: Context) {
  try {
    const { slug } = await params;
    const limit = await rateLimit(`rsvp-read:${slug}:${getClientIp(request)}`, { max: 60, windowSeconds: 60 });
    if (!limit.success) return NextResponse.json({ error: "Please try again shortly." }, { status: 429, headers: privateHeaders });
    const event = await publishedEvent(slug);
    const guestId = await resolveGuest(request, event.id);
    const token = await resolveEditToken(request, event);
    const response = await findRsvp({ query, batch }, event.id, guestId, token);
    let spotsRemaining: number | null = null;
    if (event.max_attendees) {
      const total = await queryOne<{ total: number }>("SELECT COALESCE(SUM(headcount), 0) AS total FROM rsvp_responses WHERE event_id = $1 AND status = 'attending' AND ($2 IS NULL OR id <> $2)", [event.id, response?.id ?? null]);
      spotsRemaining = Math.max(0, event.max_attendees - (total?.total ?? 0));
    }
    const deadlinePassed = Boolean(event.rsvp_deadline && new Date(event.rsvp_deadline).getTime() <= Date.now());
    const result = NextResponse.json({ response, spots_remaining: spotsRemaining, deadline_passed: deadlinePassed }, { headers: privateHeaders });
    if (!guestId) setEditCookie(result, event, token);
    return result;
  } catch (error) {
    if (error instanceof RsvpError) return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders });
    return NextResponse.json({ error: "Unable to load your response." }, { status: 500, headers: privateHeaders });
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { slug } = await params;
    const limit = await rateLimit(`rsvp:${slug}:${getClientIp(request)}`, { max: 10, windowSeconds: 300 });
    if (!limit.success) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: privateHeaders });
    const parsed = rsvpSubmissionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid submission" }, { status: 400, headers: privateHeaders });
    const event = await publishedEvent(slug);
    const guestId = await resolveGuest(request, event.id, parsed.data.guest_id);
    const editToken = await resolveEditToken(request, event, parsed.data.edit_token);
    const accountPlan = await getUserTier(event.user_id);
    const effectiveLimit = getEffectiveEventLimits(accountPlan, event.tier as EventTier).responses;
    const saved = await saveRsvp({ query, batch }, event.id, guestId, editToken, parsed.data, effectiveLimit, {
      // Validate against the field definitions read with saveRsvp's other reads; the guard
      // retries the save if a concurrent builder save changes them before the write.
      validate: async (previous) => {
        const [fields, [{ fingerprint }]] = await Promise.all([
          query<RSVPField>(
            'SELECT id, event_id, field_name, field_label, field_type, options, placeholder, is_required, is_enabled, sort_order, created_at FROM rsvp_fields WHERE event_id = $1 ORDER BY sort_order ASC',
            [event.id],
          ),
          query<{ fingerprint: string }>(`SELECT (${rsvpFieldsFingerprintSql}) AS fingerprint`, [event.id]),
        ]);
        const responseDataValidation = validateRsvpResponseData(fields, parsed.data.response_data, previous?.response_data);
        if (!responseDataValidation.valid) {
          throw new RsvpError('Please complete the required RSVP fields.', 400);
        }
        return [guard(`(${rsvpFieldsFingerprintSql}) = $2`, [event.id, fingerprint], RSVP_CHANGED)];
      },
    });
    const { response, updated } = saved;
    const { respondent_name, status, plus_ones } = parsed.data;
    const headcount = response.headcount;

    await recordActivationEventSafely({
      name: "first_rsvp_received",
      userId: event.user_id,
      eventId: event.id,
      metadata: { source: "public_event", status },
    });

    await enqueueWebhookEvent(event.id, "rsvp.submitted", {
      response: {
        id: response.id,
        respondent_name: response.respondent_name,
        respondent_email: response.respondent_email ?? null,
        status: response.status,
        headcount: response.headcount,
        guest_id: response.guest_id ?? null,
        plus_ones: (plus_ones ?? []).map((plusOne) => ({ name: plusOne.name })),
      },
    });

    // Send host notification (best-effort, don't fail the RSVP)
    try {
      const host = await queryOne<{ email: string }>(
        'SELECT email FROM admin_users WHERE id = $1',
        [event.user_id]
      );
      if (host?.email) {
        const statusLabel = status === 'attending' ? 'Yes' : status === 'maybe' ? 'Maybe' : 'No';
        const safeName = escapeHtml(respondent_name);
        const safeTitle = escapeHtml(event.title);
        await sendEmail({
          to: host.email,
          subject: `${updated ? "Updated RSVP" : "New RSVP"}: ${respondent_name} (${statusLabel}) - ${event.title}`,
          html: `<p><strong>${safeName}</strong> responded <strong>${statusLabel}</strong> to <strong>${safeTitle}</strong>${headcount > 1 ? ` with ${headcount} guests` : ''}.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://sealsend.app'}/events/${event.id}/responses">View all responses</a></p>`,
        });
      }
    } catch {
      // Non-critical, don't fail the RSVP
    }

    const result = NextResponse.json({ success: true, response, updated }, { headers: privateHeaders });
    if (!guestId) setEditCookie(result, event, editToken);
    return result;
  } catch (error) {
    if (error instanceof RsvpError) return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: privateHeaders }
    );
  }
}
