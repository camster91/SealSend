import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { rsvpSubmissionSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

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
    const event = await queryOne<any>(
      'SELECT * FROM events WHERE slug = $1 AND status = $2',
      [slug, 'published']
    );

    if (!event) {
      return NextResponse.json(
        { error: "Event not found or not published" },
        { status: 404 }
      );
    }

    // Check response limit
    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM rsvp_responses WHERE event_id = $1',
      [event.id]
    );
    const count = countResult ? parseInt(countResult.count, 10) : 0;

    const { BETA_MODE, BETA_RESPONSE_LIMIT } = await import("@/lib/constants");
    const effectiveLimit = BETA_MODE ? BETA_RESPONSE_LIMIT : event.max_responses;
    if (effectiveLimit && count >= effectiveLimit) {
      return NextResponse.json(
        {
          error: "This event has reached its maximum number of responses. The host may need to upgrade their plan.",
        },
        { status: 403 }
      );
    }

    // Validate submission
    const parsed = rsvpSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid submission" },
        { status: 400 }
      );
    }

    let { respondent_name, respondent_email, status, headcount, response_data, guest_id, plus_ones } =
      parsed.data;

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

    // Enforce total attendee limit (default: no limit)
    const maxAttendees = event.max_attendees || null;
    if (maxAttendees && status === "attending") {
      const attendingResponses = await query<{ headcount: number }>(
        'SELECT headcount FROM rsvp_responses WHERE event_id = $1 AND status = $2',
        [event.id, 'attending']
      );

      const currentTotal = attendingResponses.reduce(
        (sum, r) => sum + (r.headcount || 1),
        0
      );

      if (currentTotal + headcount > maxAttendees) {
        const spotsLeft = Math.max(0, maxAttendees - currentTotal);
        return NextResponse.json(
          {
            error: spotsLeft > 0
              ? `Only ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} remaining. Please reduce your guest count.`
              : "This event has reached its maximum number of attendees.",
          },
          { status: 403 }
        );
      }
    }

    // Insert RSVP response
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
      insertSql = `INSERT INTO rsvp_responses (event_id, respondent_name, respondent_email, status, headcount, response_data, plus_ones_data, guest_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
      insertParams.push(guest_id);
    } else {
      insertSql = `INSERT INTO rsvp_responses (event_id, respondent_name, respondent_email, status, headcount, response_data, plus_ones_data)
                    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
    }

    const response = await queryOne<any>(insertSql, insertParams);

    if (!response) {
      return NextResponse.json(
        { error: "Failed to submit RSVP" },
        { status: 500 }
      );
    }

    // Create plus_ones records if provided
    if (plus_ones && plus_ones.length > 0 && response) {
      const valueClauses: string[] = [];
      const allParams: unknown[] = [];
      let paramIndex = 1;

      for (const po of plus_ones) {
        valueClauses.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`
        );
        allParams.push(event.id, response.id, po.name, po.email || null, status);
        paramIndex += 5;
      }

      try {
        await query(
          `INSERT INTO plus_ones (event_id, rsvp_response_id, name, email, status)
           VALUES ${valueClauses.join(', ')}`,
          allParams
        );
      } catch (err) {
        console.error("Failed to create plus_ones:", err);
        // Don't fail the RSVP if plus_ones creation fails
      }
    }

    // Send host notification (best-effort, don't fail the RSVP)
    try {
      const host = await queryOne<{ email: string }>(
        'SELECT email FROM admin_users WHERE id = $1',
        [event.user_id]
      );
      if (host?.email) {
        const statusLabel = status === 'attending' ? 'Yes' : status === 'maybe' ? 'Maybe' : 'No';
        await sendEmail({
          to: host.email,
          subject: `New RSVP: ${respondent_name} (${statusLabel}) - ${event.title}`,
          html: `<p><strong>${respondent_name}</strong> responded <strong>${statusLabel}</strong> to <strong>${event.title}</strong>${headcount > 1 ? ` with ${headcount} guests` : ''}.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://sealsend.app'}/events/${event.id}/responses">View all responses</a></p>`,
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
