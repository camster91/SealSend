import { NextResponse } from "next/server";
import { prisma } from '@/lib/db';
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
    const { success } = await rateLimit(`rsvp:${ip}`, { max: 10, windowSeconds: 600 });
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();

    // Fetch the event
    const event = await prisma.event.findFirst({
      where: { slug, status: "published" },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found or not published" },
        { status: 404 }
      );
    }

    // Check if event has reached response limit
    const count = await prisma.rsvpResponse.count({
      where: { event_id: event.id },
    });

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

    // Enforce no plus ones if event doesn't allow them
    const allowPlusOnes = event.allow_plus_ones !== undefined ? event.allow_plus_ones : true;
    if (!allowPlusOnes) {
      headcount = 1;
    }

    // Enforce max guests per RSVP
    const maxPerRsvp = event.max_guests_per_rsvp || 10;
    if (headcount > maxPerRsvp) {
      return NextResponse.json(
        { error: `Maximum ${maxPerRsvp} guest${maxPerRsvp !== 1 ? "s" : ""} per RSVP.` },
        { status: 400 }
      );
    }

    // Validate plus_ones count matches headcount
    const expectedPlusOnes = Math.max(0, headcount - 1);
    const actualPlusOnes = (plus_ones || []).length;
    if (actualPlusOnes > expectedPlusOnes) {
      return NextResponse.json(
        { error: `You can only add ${expectedPlusOnes} additional guest${expectedPlusOnes !== 1 ? "s" : ""}.` },
        { status: 400 }
      );
    }

    // Check event capacity
    const maxAttendees = event.max_attendees || null;
    if (maxAttendees && status === "attending") {
      const attendingResponses = await prisma.rsvpResponse.findMany({
        where: { event_id: event.id, status: "attending" },
        select: { headcount: true },
      });

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
    const response = await prisma.rsvpResponse.create({
      data: {
        event_id: event.id,
        respondent_name,
        respondent_email: respondent_email || null,
        status,
        headcount,
        response_data,
        plus_ones_data: plus_ones || [],
        ...(guest_id && { guest_id }),
      },
    });

    // Create plus_ones records if any
    if (plus_ones && plus_ones.length > 0 && response) {
      const plusOnesToInsert = plus_ones.map((po) => ({
        event_id: event.id,
        rsvp_response_id: response.id,
        name: po.name,
        email: po.email || null,
        status: status, // Inherit the main respondent's status
      }));

      try {
        await prisma.plusOne.createMany({ data: plusOnesToInsert });
      } catch (plusOnesError) {
        console.error("Failed to create plus_ones:", plusOnesError);
        // Continue anyway - the main RSVP is already created
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
