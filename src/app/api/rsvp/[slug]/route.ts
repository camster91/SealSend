import { NextResponse } from "next/server";
import { getDb, queryOne } from "@/lib/db/client";
import { rsvpSubmissionSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/utils";
import type { Event, RSVPResponse } from "@/types/database";
import { getEffectiveEventLimits, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ip = getClientIp(request);
    const { success } = await rateLimit(`rsvp:${slug}:${ip}`, { max: 10, windowSeconds: 300 });
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();

    // Find the published event by slug
    const event = await queryOne<Event>(
      'SELECT * FROM events WHERE slug = $1 AND status = $2',
      [slug, 'published']
    );

    if (!event) {
      return NextResponse.json(
        { error: "Event not found or not published" },
        { status: 404 }
      );
    }

    const accountPlan = await getUserTier(event.user_id);
    const effectiveLimit = getEffectiveEventLimits(accountPlan, event.tier as EventTier).responses;

    // Validate submission
    const parsed = rsvpSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid submission" },
        { status: 400 }
      );
    }

    const { respondent_name, respondent_email, status, response_data, guest_id, plus_ones } = parsed.data;
    let { headcount } = parsed.data;

    // Enforce +1 restrictions (default: allow)
    const allowPlusOnes = event.allow_plus_ones !== undefined ? event.allow_plus_ones : true;
    if (!allowPlusOnes) {
      headcount = 1;
    }

    // Enforce minimum headcount
    if (headcount < 1) {
      return NextResponse.json(
        { error: "Headcount must be at least 1." },
        { status: 400 }
      );
    }

    // Enforce per-RSVP guest limit (default: 10)
    const maxPerRsvp = event.max_guests_per_rsvp || 10;
    if (headcount > maxPerRsvp) {
      return NextResponse.json(
        { error: `Maximum ${maxPerRsvp} guest${maxPerRsvp !== 1 ? "s" : ""} per RSVP.` },
        { status: 400 }
      );
    }

    // Validate plus_ones count matches headcount - 1 (main respondent)
    const expectedPlusOnes = Math.max(0, headcount - 1);
    const actualPlusOnes = (plus_ones || []).length;
    if (actualPlusOnes > expectedPlusOnes) {
      return NextResponse.json(
        { error: `You can only add ${expectedPlusOnes} additional guest${expectedPlusOnes !== 1 ? "s" : ""}.` },
        { status: 400 }
      );
    }

    // Serialize capacity checks and all RSVP writes for this event so concurrent
    // submissions cannot overbook or leave a response without its plus-ones.
    const maxAttendees = event.max_attendees || null;
    const client = await getDb().connect();
    let response: RSVPResponse;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [event.id]);

      const countResult = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM rsvp_responses WHERE event_id = $1',
        [event.id]
      );
      const count = parseInt(countResult.rows[0]?.count || '0', 10);
      if (effectiveLimit && count >= effectiveLimit) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: "This event has reached its maximum number of responses. The host may need to upgrade their plan." }, { status: 403 });
      }

      if (maxAttendees && status === "attending") {
        const sumResult = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(headcount), 0)::text AS total
         FROM rsvp_responses WHERE event_id = $1 AND status = $2`,
        [event.id, 'attending']
      );
        const currentTotal = parseInt(sumResult.rows[0]?.total || '0', 10);

        if (currentTotal + headcount > maxAttendees) {
          const spotsLeft = Math.max(0, maxAttendees - currentTotal);
          await client.query('ROLLBACK');
          return NextResponse.json({ error: spotsLeft > 0 ? `Only ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} remaining. Please reduce your guest count.` : "This event has reached its maximum number of attendees." }, { status: 403 });
        }
      }

      const insertParams: unknown[] = [
      event.id,
      respondent_name,
      respondent_email || null,
      status,
      headcount,
      response_data ? JSON.stringify(response_data) : null,
      plus_ones ? JSON.stringify(plus_ones) : JSON.stringify([]),
    ];
      let insertSql: string;

    if (guest_id) {
      // Bind guest_id to this event only — prevent cross-event IDOR
      const guestResult = await client.query<{ id: string }>(
        'SELECT id FROM guests WHERE id = $1 AND event_id = $2',
        [guest_id, event.id]
      );
      if (!guestResult.rows[0]) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: "Invalid guest for this event" },
          { status: 400 }
        );
      }
      insertSql = `INSERT INTO rsvp_responses (event_id, respondent_name, respondent_email, status, headcount, response_data, plus_ones_data, guest_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
      insertParams.push(guest_id);
    } else {
      insertSql = `INSERT INTO rsvp_responses (event_id, respondent_name, respondent_email, status, headcount, response_data, plus_ones_data)
                    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
    }

      const responseResult = await client.query<RSVPResponse>(insertSql, insertParams);
      const insertedResponse = responseResult.rows[0];

      if (!insertedResponse) throw new Error('RSVP insert returned no row');
      response = insertedResponse;

    // Create plus_ones records if provided
      if (plus_ones && plus_ones.length > 0) {
      const valueClauses: string[] = [];
      const allParams: unknown[] = [];
      let paramIndex = 1;

      for (const po of plus_ones) {
        valueClauses.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`
        );
        allParams.push(event.id, insertedResponse.id, po.name, po.email || null, status);
        paramIndex += 5;
      }

        await client.query(
          `INSERT INTO plus_ones (event_id, rsvp_response_id, name, email, status)
           VALUES ${valueClauses.join(', ')}`,
          allParams
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

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
          subject: `New RSVP: ${respondent_name} (${statusLabel}) - ${event.title}`,
          html: `<p><strong>${safeName}</strong> responded <strong>${statusLabel}</strong> to <strong>${safeTitle}</strong>${headcount > 1 ? ` with ${headcount} guests` : ''}.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://sealsend.app'}/events/${event.id}/responses">View all responses</a></p>`,
        });
      }
    } catch {
      // Non-critical, don't fail the RSVP
    }

    return NextResponse.json({ success: true, response });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
