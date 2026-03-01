import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildInvitationEmail } from "@/lib/email-templates";
import { buildInviteSms } from "@/lib/sms-templates";
import { generateInviteToken } from "@/lib/utils";
import { isTwilioConfigured, getTwilioClient, getTwilioSendOptions } from "@/lib/twilio";
import { rateLimit } from "@/lib/rate-limit";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { logSendSuccess, logSendFailure } from "@/lib/email-logger";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: rateLimitOk } = rateLimit(`send-invites:${user.id}`, { max: 5, windowSeconds: 3600 });
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Too many send requests. Please wait before sending again." }, { status: 429 });
    }

    const adminSupabase = createAdminClient();

    // Ownership + status check
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("id, title, event_date, location_name, slug, status, design_url, host_name, dress_code, rsvp_deadline, tier")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { error: "Event must be published before sending invites" },
        { status: 400 }
      );
    }

    // Fetch guests that need invitations (email OR phone)
    const { data: guests, error: guestsError } = await adminSupabase
      .from("guests")
      .select("id, name, email, phone, invite_status, invite_token")
      .eq("event_id", eventId)
      .in("invite_status", ["not_sent", "failed"]);

    if (guestsError) {
      return NextResponse.json(
        { error: guestsError.message },
        { status: 500 }
      );
    }

    // Filter to guests that have email or phone
    const sendableGuests = (guests || []).filter((g) => g.email || g.phone);
    if (sendableGuests.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, sms_sent: 0, sms_failed: 0 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
    // SMS requires standard or premium tier (unlocked in beta)
    const { BETA_MODE } = await import("@/lib/constants");
    const smsEnabled = isTwilioConfigured() && (BETA_MODE || event.tier !== "free");

    // Process all guests in parallel (batches of 10 to avoid overwhelming APIs)
    const BATCH_SIZE = 10;
    let sent = 0;
    let failed = 0;
    let smsSent = 0;
    let smsFailed = 0;
    const successIds: string[] = [];
    const failedIds: string[] = [];

    for (let i = 0; i < sendableGuests.length; i += BATCH_SIZE) {
      const batch = sendableGuests.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (guest) => {
          // Generate invite token if guest doesn't have one
          let token = guest.invite_token;
          if (!token) {
            token = generateInviteToken();
            await adminSupabase
              .from("guests")
              .update({ invite_token: token })
              .eq("id", guest.id);
          }

          const rsvpUrl = `${siteUrl}/e/${event.slug}?t=${token}`;
          let emailOk = false;
          let smsOk = false;
          const errors: Array<{ type: 'email' | 'sms'; message: string }> = [];

          // Send email if guest has email
          if (guest.email) {
            const { subject, html } = buildInvitationEmail({
              guestName: guest.name,
              eventTitle: event.title,
              eventDate: event.event_date,
              locationName: event.location_name,
              designUrl: event.design_url,
              hostName: event.host_name || undefined,
              dressCode: event.dress_code,
              rsvpDeadline: event.rsvp_deadline,
              rsvpUrl,
            });

            try {
              const result = await sendEmail({
                to: guest.email,
                subject,
                html,
              });
              emailOk = true;
              
              // Log successful send
              await logSendSuccess(eventId, 'email', guest.email, {
                guestId: guest.id,
                subject,
                provider: 'mailgun',
                providerMessageId: result.id,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Email send failed';
              errors.push({ type: 'email', message });
              console.error(`[EMAIL FAILED] ${guest.email}:`, message);
              
              await logSendFailure(eventId, 'email', guest.email, message, {
                guestId: guest.id,
                subject: event.title,
              });
            }
          }

          // Send SMS if guest has phone and Twilio is configured
          if (guest.phone && smsEnabled) {
            // Validate and format phone number
            const phoneValidation = validateAndFormatPhone(guest.phone);
            
            if (!phoneValidation.valid) {
              errors.push({ type: 'sms', message: phoneValidation.error || 'Invalid phone number' });
              console.error(`[SMS INVALID] ${guest.phone}:`, phoneValidation.error);
              
              await logSendFailure(eventId, 'sms', guest.phone, phoneValidation.error || 'Invalid phone', {
                guestId: guest.id,
              });
            } else {
              const formattedPhone = phoneValidation.formatted!;
              const smsBody = buildInviteSms({
                guestName: guest.name,
                eventTitle: event.title,
                eventDate: event.event_date,
                locationName: event.location_name,
                hostName: event.host_name || undefined,
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
                
                // Log successful SMS
                await logSendSuccess(eventId, 'sms', formattedPhone, {
                  guestId: guest.id,
                  provider: 'twilio',
                  providerMessageId: result.sid,
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : 'SMS send failed';
                errors.push({ type: 'sms', message });
                console.error(`[SMS FAILED] ${guest.phone}:`, message);
                
                await logSendFailure(eventId, 'sms', guest.phone, message, {
                  guestId: guest.id,
                  provider: 'twilio',
                });
              }
            }
          }

          return { guestId: guest.id, emailOk, smsOk, errors };
        })
      );

      // Aggregate results
      for (const result of results) {
        if (result.status === "fulfilled") {
          const { guestId, emailOk, smsOk, errors } = result.value;
          const guest = batch.find((g) => g.id === guestId);
          
          if (emailOk) {
            sent++;
          } else if (guest?.email) {
            failed++;
            console.error(`[INVITE FAILED] Guest ${guestId} email failed:`, 
              errors.filter(e => e.type === 'email').map(e => e.message).join(', '));
          }
          
          if (smsOk) {
            smsSent++;
          } else if (smsEnabled && guest?.phone) {
            smsFailed++;
            const smsErrors = errors.filter(e => e.type === 'sms').map(e => e.message).join(', ');
            if (smsErrors) {
              console.error(`[INVITE SMS FAILED] Guest ${guestId}:`, smsErrors);
            }
          }

          if (emailOk || smsOk) {
            successIds.push(guestId);
          } else {
            failedIds.push(guestId);
          }
        } else {
          // Promise was rejected (shouldn't happen with our try/catch, but handle just in case)
          console.error('[BATCH ERROR] Promise rejected:', result.reason);
        }
      }
    }

    // Batch update statuses
    if (successIds.length > 0) {
      await adminSupabase
        .from("guests")
        .update({ invite_status: "sent", invite_sent_at: new Date().toISOString() })
        .in("id", successIds);
    }
    if (failedIds.length > 0) {
      await adminSupabase
        .from("guests")
        .update({ invite_status: "failed" })
        .in("id", failedIds);
    }

    return NextResponse.json({ sent, failed, sms_sent: smsSent, sms_failed: smsFailed });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
