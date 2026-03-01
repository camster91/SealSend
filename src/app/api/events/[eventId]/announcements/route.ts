import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { getResendClient } from "@/lib/resend";
import { buildAnnouncementEmail } from "@/lib/email-templates";
import { buildAnnouncementSms } from "@/lib/sms-templates";
import { announcementSchema } from "@/lib/validations";
import { isTwilioConfigured, getTwilioClient, getTwilioSendOptions } from "@/lib/twilio";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(
  _request: Request,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminSupabase = createAdminClient();

    // Verify ownership
    const { data: event } = await adminSupabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: announcements, error } = await adminSupabase
      .from("event_announcements")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(announcements);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { success: rateLimitOk } = rateLimit(`announcements:${user.id}`, { max: 5, windowSeconds: 3600 });
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Too many send requests. Please wait before sending again." }, { status: 429 });
    }

    const adminSupabase = createAdminClient();

    // Ownership + status check
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("id, title, slug, status, tier")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { error: "Event must be published before sending announcements" },
        { status: 400 }
      );
    }

    // Tier gate: announcements require standard or premium
    if (event.tier === "free") {
      return NextResponse.json(
        { error: "Announcements require a Standard or Premium upgrade" },
        { status: 403 }
      );
    }

    const parsed = announcementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Fetch all guests with email or phone
    const { data: guests, error: guestsError } = await adminSupabase
      .from("guests")
      .select("id, name, email, phone, invite_token")
      .eq("event_id", eventId);

    if (guestsError) {
      return NextResponse.json({ error: guestsError.message }, { status: 500 });
    }

    const resend = getResendClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
    const smsEnabled = isTwilioConfigured();

    const BATCH_SIZE = 10;
    let sentCount = 0;

    const allGuests = (guests || []).filter((g) => g.email || g.phone);

    for (let i = 0; i < allGuests.length; i += BATCH_SIZE) {
      const batch = allGuests.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (guest) => {
          const rsvpUrl = guest.invite_token
            ? `${siteUrl}/e/${event.slug}?t=${guest.invite_token}`
            : `${siteUrl}/e/${event.slug}`;

          let ok = false;

          if (guest.email) {
            const { subject, html } = buildAnnouncementEmail({
              guestName: guest.name,
              eventTitle: event.title,
              announcementSubject: parsed.data.subject,
              announcementMessage: parsed.data.message,
              rsvpUrl,
            });

            try {
              await resend.emails.send({
                from: "Seal and Send <contact@sealsend.app>",
                to: guest.email,
                subject,
                html,
              });
              ok = true;
            } catch {}
          }

          if (guest.phone && smsEnabled) {
            const smsBody = buildAnnouncementSms({
              guestName: guest.name,
              eventTitle: event.title,
              subject: parsed.data.subject,
              rsvpUrl,
            });

            try {
              const twilioClient = getTwilioClient();
              await twilioClient.messages.create({
                body: smsBody,
                to: guest.phone,
                ...getTwilioSendOptions(),
              });
              ok = true;
            } catch {}
          }

          return ok;
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) sentCount++;
      }
    }

    // Save the announcement record
    const { data: announcement, error: insertError } = await adminSupabase
      .from("event_announcements")
      .insert({
        event_id: eventId,
        subject: parsed.data.subject,
        message: parsed.data.message,
        sent_to_count: sentCount,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(announcement, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
