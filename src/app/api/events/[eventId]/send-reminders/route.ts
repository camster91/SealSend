import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { buildReminderEmail } from "@/lib/email-templates";
import { buildReminderSms } from "@/lib/sms-templates";
import { isTwilioConfigured, getTwilioClient, getTwilioSendOptions } from "@/lib/twilio";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { logSendSuccess, logSendFailure } from "@/lib/email-logger";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { success: rateLimitOk } = rateLimit(`send-reminders:${user.id}`, { max: 5, windowSeconds: 3600 });
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Too many send requests. Please wait before sending again." }, { status: 429 });
    }

    const adminSupabase = createAdminClient();

    // Ownership + status check
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("id, title, event_date, location_name, slug, status, tier")
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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
    const smsEnabled = isTwilioConfigured() && event.tier !== "free";

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
          const errors: Array<{ type: 'email' | 'sms'; message: string }> = [];

          if (guest.email) {
            const { subject, html } = buildReminderEmail({
              guestName: guest.name,
              eventTitle: event.title,
              eventDate: event.event_date,
              locationName: event.location_name,
              rsvpUrl,
            });

            try {
              const result = await sendEmail({
                to: guest.email,
                subject,
                html,
              });
              emailOk = true;
              
              await logSendSuccess(eventId, 'email', guest.email, {
                guestId: guest.id,
                subject,
                provider: 'mailgun',
                providerMessageId: result.id,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Email send failed';
              errors.push({ type: 'email', message });
              console.error(`[REMINDER EMAIL FAILED] ${guest.email}:`, message);
              
              await logSendFailure(eventId, 'email', guest.email, message, {
                guestId: guest.id,
                subject: `Reminder: ${event.title}`,
                provider: 'mailgun',
              });
            }
          }

          if (guest.phone && smsEnabled) {
            // Validate and format phone number
            const phoneValidation = validateAndFormatPhone(guest.phone);
            
            if (!phoneValidation.valid) {
              errors.push({ type: 'sms', message: phoneValidation.error || 'Invalid phone number' });
              console.error(`[REMINDER SMS INVALID] ${guest.phone}:`, phoneValidation.error);
              
              await logSendFailure(eventId, 'sms', guest.phone, phoneValidation.error || 'Invalid phone', {
                guestId: guest.id,
              });
            } else {
              const formattedPhone = phoneValidation.formatted!;
              const smsBody = buildReminderSms({
                guestName: guest.name,
                eventTitle: event.title,
                eventDate: event.event_date,
                rsvpUrl,
              });

              try {
                const twilioClient = getTwilioClient();
                const result = await twilioClient.messages.create({
                  body: smsBody,
                  to: formattedPhone,
                  ...getTwilioSendOptions(),
                });
                smsOk = true;
                
                await logSendSuccess(eventId, 'sms', formattedPhone, {
                  guestId: guest.id,
                  provider: 'twilio',
                  providerMessageId: result.sid,
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : 'SMS send failed';
                errors.push({ type: 'sms', message });
                console.error(`[REMINDER SMS FAILED] ${guest.phone}:`, message);
                
                await logSendFailure(eventId, 'sms', guest.phone, message, {
                  guestId: guest.id,
                  provider: 'twilio',
                });
              }
            }
          }

          return { guestId: guest.id, emailOk, smsOk, hasEmail: !!guest.email, hasPhone: !!guest.phone, errors };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { guestId, emailOk, smsOk, hasEmail, hasPhone, errors } = result.value;
          
          if (emailOk) {
            sent++;
          } else if (hasEmail) {
            failed++;
            console.error(`[REMINDER FAILED] Guest ${guestId} email failed:`,
              errors.filter(e => e.type === 'email').map(e => e.message).join(', '));
          }
          
          if (smsOk) {
            smsSent++;
          } else if (smsEnabled && hasPhone) {
            smsFailed++;
            const smsErrors = errors.filter(e => e.type === 'sms').map(e => e.message).join(', ');
            if (smsErrors) {
              console.error(`[REMINDER SMS FAILED] Guest ${guestId}:`, smsErrors);
            }
          }
          
          if (emailOk || smsOk) successIds.push(guestId);
        } else {
          console.error('[REMINDER BATCH ERROR] Promise rejected:', result.reason);
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
  } catch (error) {
    console.error('[REMINDER SEND ERROR]', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
