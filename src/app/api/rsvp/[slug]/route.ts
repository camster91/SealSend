import { NextResponse } from "next/server";
import { prisma } from '@/lib/db';
import { rsvpSubmissionSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = getClientIp(request);
    const { success } = await rateLimit(`rsvp:${ip}`, { max: 10, windowSeconds: 600 });
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { slug } = await params;
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
    if (count !== null && effectiveLimit && count >= effectiveLimit) {
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
        { error: "Invalid submission", details: parsed.error.flatten() },
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

      const currentTotal = (attendingResponses || []).reduce(
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

    return NextResponse.json({ success: true, response });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
