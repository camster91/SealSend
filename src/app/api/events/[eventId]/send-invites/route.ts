import { NextRequest, NextResponse } from "next/server";
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { query, queryOne } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";
import { buildInvitationEmail } from "@/lib/email-templates";
import { buildInviteSms } from "@/lib/sms-templates";
import { generateInviteToken } from "@/lib/invite-token";
import { isTwilioConfigured, getTwilioClient, getTwilioSendOptions } from "@/lib/twilio";
import { rateLimit } from "@/lib/rate-limit";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { logSendSuccess, logSendFailure } from "@/lib/email-logger";
import type { Event, Guest } from "@/types/database";
import { canUseFeature, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { assertApprovedRecipient } from "@/lib/communications-safety";
import { getCommunicationSuppressions, isCommunicationSuppressed } from "@/lib/communication-suppressions";
import { countSmsSegments } from "@/lib/messages/cost-estimate";
import { decideSmsSend, getSmsBalance, isSmsMetered, recordSmsUsage, smsAllowanceMessage } from "@/lib/sms-allowance";
import { emailBrand, emailSendOptions, getEventBranding, smsSignature } from "@/lib/brands";

type InviteEvent = Pick<Event, "id" | "title" | "event_date" | "event_timezone" | "location_name" | "slug" | "status" | "design_url" | "host_name" | "dress_code" | "rsvp_deadline" | "tier">;
type InviteGuest = Pick<Guest, "id" | "name" | "email" | "phone" | "invite_status" | "invite_token" | "phone_invalid_at">;

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
    const auth = await requireEventPermission(eventId, 'send_messages');
    if (auth.error) return auth.error;
    const user = auth.user;

    const { success: rateLimitOk } = await rateLimit(`send-invites:${user.id}`, { max: 5, windowSeconds: 3600 });
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Too many send requests. Please wait before sending again." }, { status: 429 });
    }

    // Ownership + status check
    const event = await queryOne<InviteEvent & { user_id: string }>(
      'SELECT id, user_id, title, event_date, event_timezone, location_name, slug, status, design_url, host_name, dress_code, rsvp_deadline, tier FROM events WHERE id = $1',
      [eventId]
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
    const guests = await query<InviteGuest>(
      `SELECT id, name, email, phone, invite_status, invite_token, phone_invalid_at FROM guests
       WHERE event_id = $1 AND invite_status IN ('not_sent', 'failed')`,
      [eventId]
    );

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
    // SMS requires standard or premium tier (unlocked in beta)
    const accountPlan = await getUserTier(event.user_id);
    const smsEnabled = isTwilioConfigured() && canUseFeature(accountPlan, event.tier as EventTier, "smsInvites");
    const suppressions = await getCommunicationSuppressions(event.user_id);
    const branding = await getEventBranding(eventId);
    const sendableGuests = guests.map((guest) => {
      const email = guest.email && !isCommunicationSuppressed(suppressions, "email", guest.email)
        ? guest.email
        : null;
      let phone = smsEnabled && !guest.phone_invalid_at ? guest.phone : null;
      if (phone) {
        const validation = validateAndFormatPhone(phone);
        if (validation.valid && validation.formatted && isCommunicationSuppressed(suppressions, "sms", validation.formatted)) phone = null;
      }
      return { ...guest, email, phone };
    }).filter((guest) => guest.email || guest.phone);
    if (sendableGuests.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, sms_sent: 0, sms_failed: 0 });
    }

    const smsMetered = smsEnabled && isSmsMetered(accountPlan, event.tier as string);
    if (smsMetered) {
      // Estimate with a token of the same length generateInviteToken() produces.
      const sampleUrl = (token: string | null) => `${siteUrl}/invite/accept?token=${token ?? "x".repeat(24)}&event=${event.slug}`;
      const requiredSegments = sendableGuests.reduce((total, guest) => total + (guest.phone
        ? countSmsSegments(buildInviteSms({ signature: smsSignature(branding),
            guestName: guest.name,
            eventTitle: event.title,
            eventDate: event.event_date,
            locationName: event.location_name,
            hostName: event.host_name || undefined,
            rsvpUrl: sampleUrl(guest.invite_token),
          }))
        : 0), 0);
      const decision = decideSmsSend(true, await getSmsBalance(eventId), requiredSegments);
      if (!decision.allowed) {
        return NextResponse.json({ error: smsAllowanceMessage(decision), code: "SMS_ALLOWANCE_EXCEEDED" }, { status: 402 });
      }
    }

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
            const guestEmail = guest.email;
            const { subject, html } = buildInvitationEmail({ brand: emailBrand(branding),
              guestName: guest.name,
              eventTitle: event.title,
              eventDate: event.event_date,
              eventTimezone: event.event_timezone,
              locationName: event.location_name,
              designUrl: event.design_url,
              hostName: event.host_name || undefined,
              dressCode: event.dress_code,
              rsvpDeadline: event.rsvp_deadline,
              rsvpUrl,
              qrCodeUrl: `${siteUrl}/api/guest-qr/${encodeURIComponent(token)}`,
            });

            try {
              const result = await withRetry(() => sendEmail({ ...emailSendOptions(branding),
                to: guestEmail,
                subject,
                html,
              }));
              emailOk = true;

              // Log successful send
              await logSendSuccess(eventId, 'email', guestEmail, {
                guestId: guest.id,
                subject,
                provider: 'mailgun',
                providerMessageId: result.id,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Email send failed';
              errors.push({ type: 'email', message });
              console.error(`[EMAIL FAILED] guest=${guest.id}:`, message);

              await logSendFailure(eventId, 'email', guestEmail, message, {
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
              await query('UPDATE guests SET phone_invalid_at = NOW(), updated_at = NOW() WHERE id = $1', [guest.id]);
              errors.push({ type: 'sms', message: phoneValidation.error || 'Invalid phone number' });
              console.error(`[SMS INVALID] guest=${guest.id}:`, phoneValidation.error);

              await logSendFailure(eventId, 'sms', guest.phone, phoneValidation.error || 'Invalid phone', {
                guestId: guest.id,
              });
            } else {
              const formattedPhone = phoneValidation.formatted!;
              const smsBody = buildInviteSms({ signature: smsSignature(branding),
                guestName: guest.name,
                eventTitle: event.title,
                eventDate: event.event_date,
                locationName: event.location_name,
                hostName: event.host_name || undefined,
                rsvpUrl,
              });

              try {
                assertApprovedRecipient(formattedPhone);
                const twilioClient = getTwilioClient();
                const result = await withRetry(() => twilioClient.messages.create({
                  body: smsBody,
                  to: formattedPhone,
                  ...getTwilioSendOptions(),
                }));
                smsOk = true;
                if (smsMetered) await recordSmsUsage(eventId, countSmsSegments(smsBody), `twilio:${result.sid}`);

                // Log successful SMS
                await logSendSuccess(eventId, 'sms', formattedPhone, {
                  guestId: guest.id,
                  provider: 'twilio',
                  providerMessageId: result.sid,
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : 'SMS send failed';
                errors.push({ type: 'sms', message });
                console.error(`[SMS FAILED] guest=${guest.id}:`, message);

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
      // Store sanitized error only — never persist raw provider messages
      await Promise.all(failedGuests.map(({ id }) =>
        query(
          'UPDATE guests SET invite_status = $1, invite_error = $2 WHERE id = $3',
          ['failed', 'Delivery failed', id]
        )
      ));
    }

    if (successIds.length > 0) {
      await recordActivationEventSafely({
        name: "first_invitation_sent",
        userId: event.user_id,
        eventId,
        metadata: { channel: smsSent > 0 && sent > 0 ? "email_and_sms" : smsSent > 0 ? "sms" : "email" },
      });
    }

    await query(
      `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
       VALUES ($1, $2, 'invitations_sent', $3::jsonb)`,
      [eventId, user.id, JSON.stringify({ emailAccepted: sent, emailFailed: failed, smsAccepted: smsSent, smsFailed })]
    );

    return NextResponse.json({ sent, failed, sms_sent: smsSent, sms_failed: smsFailed });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
