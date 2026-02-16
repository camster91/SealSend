import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { getResendClient } from "@/lib/resend";
import { buildReminderEmail } from "@/lib/email-templates";
import { buildReminderSms } from "@/lib/sms-templates";
import { isTwilioConfigured, getTwilioClient, getTwilioSendOptions } from "@/lib/twilio";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: rateLimitOk } = rateLimit(`send-reminders:${user.id}`, { max: 5, windowSeconds: 3600 });
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Too many send requests. Please wait before sending again." }, { status: 429 });
    }

    const adminSupabase = createAdminClient();

    // Ownership + status check
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("id, title, event_date, location_name, slug, status")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { error: "Event must be published before sending reminders" },
        { status: 400 }
      );
    }

    // Fetch guests that have been invited but not reminded
    const { data: guests, error: guestsError } = await adminSupabase
      .from("guests")
      .select("id, name, email, phone, invite_status, invite_token, reminder_sent_at")
      .eq("event_id", eventId)
      .eq("invite_status", "sent")
      .is("reminder_sent_at", null);

    if (guestsError) {
      return NextResponse.json({ error: guestsError.message }, { status: 500 });
    }

    // Filter to guests with email or phone
    const sendableGuests = (guests || []).filter((g) => g.email || g.phone);
    if (sendableGuests.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, sms_sent: 0, sms_failed: 0 });
    }

    const resend = getResendClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
    const smsEnabled = isTwilioConfigured();

    const BATCH_SIZE = 10;
    let sent = 0;
    let failed = 0;
    let smsSent = 0;
    let smsFailed = 0;
    const successIds: string[] = [];

    for (let i = 0; i < sendableGuests.length; i += BATCH_SIZE) {
      const batch = sendableGuests.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (guest) => {
          const rsvpUrl = guest.invite_token
            ? `${siteUrl}/e/${event.slug}?t=${guest.invite_token}`
            : `${siteUrl}/e/${event.slug}`;

          let emailOk = false;
          let smsOk = false;

          if (guest.email) {
            const { subject, html } = buildReminderEmail({
              guestName: guest.name,
              eventTitle: event.title,
              eventDate: event.event_date,
              locationName: event.location_name,
              rsvpUrl,
            });

            try {
              await resend.emails.send({
                from: "Seal and Send <noreply@ashbi.ca>",
                to: guest.email,
                subject,
                html,
              });
              emailOk = true;
            } catch {}
          }

          if (guest.phone && smsEnabled) {
            const smsBody = buildReminderSms({
              guestName: guest.name,
              eventTitle: event.title,
              eventDate: event.event_date,
              rsvpUrl,
            });

            try {
              const twilioClient = getTwilioClient();
              await twilioClient.messages.create({
                body: smsBody,
                to: guest.phone,
                ...getTwilioSendOptions(),
              });
              smsOk = true;
            } catch {}
          }

          return { guestId: guest.id, emailOk, smsOk, hasEmail: !!guest.email, hasPhone: !!guest.phone };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { guestId, emailOk, smsOk, hasEmail, hasPhone } = result.value;
          if (emailOk) sent++;
          else if (hasEmail) failed++;
          if (smsOk) smsSent++;
          else if (smsEnabled && hasPhone) smsFailed++;
          if (emailOk || smsOk) successIds.push(guestId);
        }
      }
    }

    if (successIds.length > 0) {
      await adminSupabase
        .from("guests")
        .update({ reminder_sent_at: new Date().toISOString() })
        .in("id", successIds);
    }

    return NextResponse.json({ sent, failed, sms_sent: smsSent, sms_failed: smsFailed });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
