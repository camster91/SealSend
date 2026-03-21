import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";
import { buildInvitationEmail } from "@/lib/email-templates";
import { buildInviteSms } from "@/lib/sms-templates";
import { generateInviteToken } from "@/lib/utils";
import { isTwilioConfigured, getTwilioClient, getTwilioSendOptions } from "@/lib/twilio";
import { rateLimit } from "@/lib/rate-limit";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { logSendSuccess, logSendFailure } from "@/lib/email-logger";

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
    }
  }
  throw new Error('Retry exhausted');
}

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: rateLimitOk } = await rateLimit(`send-invites:${user.id}`, { max: 5, windowSeconds: 3600 });
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Too many send requests. Please wait before sending again." }, { status: 429 });
    }

    // Ownership + status check
    const event = await queryOne<any>(
      'SELECT id, title, event_date, location_name, slug, status, design_url, host_name, dress_code, rsvp_deadline, tier FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { error: "Event must be published before sending invites" },
        { status: 400 }
      );
    }

    // Fetch guests that need invitations (email OR phone)
    const guests = await query<any>(
      `SELECT id, name, email, phone, invite_status, invite_token FROM guests
       WHERE event_id = $1 AND invite_status IN ('not_sent', 'failed')`,
      [eventId]
    );

    // Filter to guests that have email or phone
    const sendableGuests = guests.filter((g) => g.email || g.phone);
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
    const failedGuests: Array<{ id: string; error: string }> = [];

    for (let i = 0; i < sendableGuests.length; i += BATCH_SIZE) {
      const batch = sendableGuests.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (guest) => {
          // Generate invite token if guest doesn't have one
          let token = guest.invite_token;
          if (!token) {
            token = generateInviteToken();
            await query(
              'UPDATE guests SET invite_token = $1 WHERE id = $2',
              [token, guest.id]
            );
          }

          // Create a seamless magic invite link that auto-logs the guest in
          const magicInviteUrl = `${siteUrl}/invite/accept?token=${token}&event=${event.slug}`;
          const rsvpUrl = magicInviteUrl;
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
              const result = await withRetry(() => sendEmail({
                to: guest.email,
                subject,
                html,
              }));
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
                const result = await withRetry(() => twilioClient.messages.create({
                  body: smsBody,
                  to: formattedPhone,
                  ...getTwilioSendOptions(),
                }));
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
            const errorMsg = errors.map(e => `${e.type}: ${e.message}`).join('; ');
            failedGuests.push({ id: guestId, error: errorMsg || 'Send failed' });
          }
        } else {
          // Promise was rejected (shouldn't happen with our try/catch, but handle just in case)
          console.error('[BATCH ERROR] Promise rejected:', result.reason);
        }
      }
    }

    // Batch update statuses
    if (successIds.length > 0) {
      const placeholders = successIds.map((_, i) => `$${i + 3}`).join(', ');
      await query(
        `UPDATE guests SET invite_status = $1, invite_sent_at = $2 WHERE id IN (${placeholders})`,
        ['sent', new Date().toISOString(), ...successIds]
      );
    }
    if (failedGuests.length > 0) {
      // Update each failed guest with their specific error message
      await Promise.all(failedGuests.map(({ id, error }) =>
        query(
          'UPDATE guests SET invite_status = $1, invite_error = $2 WHERE id = $3',
          ['failed', error, id]
        )
      ));
    }

    return NextResponse.json({ sent, failed, sms_sent: smsSent, sms_failed: smsFailed });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
