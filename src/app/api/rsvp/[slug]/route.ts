import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rsvpSubmissionSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = getClientIp(request);
    const { success } = rateLimit(`rsvp:${ip}`, { max: 10, windowSeconds: 600 });
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { slug } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    // Find the published event by slug
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found or not published" },
        { status: 404 }
      );
    }

    // Check response limit
    const { count } = await supabase
      .from("rsvp_responses")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event.id);

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

    let { respondent_name, respondent_email, status, headcount, response_data, guest_id } =
      parsed.data;

    // Enforce +1 restrictions (default: allow)
    const allowPlusOnes = event.allow_plus_ones !== undefined ? event.allow_plus_ones : true;
    if (!allowPlusOnes) {
      headcount = 1;
    }

    // Enforce per-RSVP guest limit (default: 10)
    const maxPerRsvp = event.max_guests_per_rsvp || 10;
    if (headcount > maxPerRsvp) {
      return NextResponse.json(
        { error: `Maximum ${maxPerRsvp} guest${maxPerRsvp !== 1 ? "s" : ""} per RSVP.` },
        { status: 400 }
      );
    }

    // Enforce total attendee limit (default: no limit)
    const maxAttendees = event.max_attendees || null;
    if (maxAttendees && status === "attending") {
      const { data: attendingResponses } = await supabase
        .from("rsvp_responses")
        .select("headcount")
        .eq("event_id", event.id)
        .eq("status", "attending");

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
    const { data: response, error: insertError } = await supabase
      .from("rsvp_responses")
      .insert({
        event_id: event.id,
        respondent_name,
        respondent_email: respondent_email || null,
        status,
        headcount,
        response_data,
        ...(guest_id && { guest_id }),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to submit RSVP" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, response });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
