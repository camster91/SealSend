import { NextRequest, NextResponse } from "next/server";
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { query, queryOne } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { buildReminderEmail } from "@/lib/email-templates";
import { buildReminderSms } from "@/lib/sms-templates";
import { isTwilioConfigured, getTwilioClient, getTwilioSendOptions } from "@/lib/twilio";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { logSendSuccess, logSendFailure } from "@/lib/email-logger";
import type { Event, Guest } from "@/types/database";
import { assertApprovedRecipient } from "@/lib/communications-safety";

type ReminderEvent = Pick<Event, "id" | "title" | "event_date" | "location_name" | "slug" | "status" | "tier">;
type ReminderGuest = Pick<Guest, "id" | "name" | "email" | "phone" | "invite_status" | "invite_token" | "reminder_sent_at">;

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const auth = await requireEventPermission(eventId, 'send_messages');
    if (auth.error) return auth.error;
    const user = auth.user;

    const { success: rateLimitOk } = await rateLimit(`send-reminders:${user.id}`, { max: 5, windowSeconds: 3600 });
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Too many send requests. Please wait before sending again." }, { status: 429 });
    }

    // Ownership + status check
    const event = await queryOne<ReminderEvent>(
      'SELECT id, title, event_date, location_name, slug, status, tier FROM events WHERE id = $1',
      [eventId]
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { error: "Event must be published before sending reminders" },
        { status: 400 }
      );
    }

    // Fetch guests that have been invited but not reminded
    const guests = await query<ReminderGuest>(
      `SELECT id, name, email, phone, invite_status, invite_token, reminder_sent_at
       FROM guests
       WHERE event_id = $1 AND invite_status = $2 AND reminder_sent_at IS NULL`,
      [eventId, 'sent']
    );

    // Filter to guests with email or phone
    const sendableGuests = guests.filter((g) => g.email || g.phone);
    if (sendableGuests.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, sms_sent: 0, sms_failed: 0 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
    const { BETA_MODE } = await import("@/lib/constants");
    const smsEnabled = isTwilioConfigured() && (BETA_MODE || event.tier !== "free");

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
              console.error(`[REMINDER EMAIL FAILED] guest=${guest.id}:`, message);

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
              console.error(`[REMINDER SMS INVALID] guest=${guest.id}:`, phoneValidation.error);

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
                assertApprovedRecipient(formattedPhone);
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
                console.error(`[REMINDER SMS FAILED] guest=${guest.id}:`, message);

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
      const placeholders = successIds.map((_, i) => `$${i + 2}`).join(', ');
      await query(
        `UPDATE guests SET reminder_sent_at = $1 WHERE id IN (${placeholders})`,
        [new Date().toISOString(), ...successIds]
      );
    }

    await query(
      `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
       VALUES ($1, $2, 'reminders_sent', $3::jsonb)`,
      [eventId, user.id, JSON.stringify({ emailAccepted: sent, emailFailed: failed, smsAccepted: smsSent, smsFailed })]
    );

    return NextResponse.json({ sent, failed, sms_sent: smsSent, sms_failed: smsFailed });
  } catch (error) {
    console.error('[REMINDER SEND ERROR]', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
