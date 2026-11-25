import { NextRequest, NextResponse } from "next/server";
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { query, queryOne } from "@/lib/db/client";
import { SQL_NOW } from "@/lib/db/sqlite-dialect";
import { sendEmail } from "@/lib/email";
import { buildInvitationEmail } from "@/lib/email-templates";
import { buildInviteSms } from "@/lib/sms-templates";
import { generateInviteToken } from "@/lib/invite-token";
import { isTwilioConfigured, getTwilioClient, getTwilioSendOptions } from "@/lib/twilio";
import { rateLimit } from "@/lib/rate-limit";
import { emailQuotaMessage, reserveEmailQuota } from "@/lib/email-quota";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { logSendSuccess, logSendFailure } from "@/lib/email-logger";
import type { Event, Guest } from "@/types/database";
import { canUseFeature, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { assertApprovedRecipient } from "@/lib/communications-safety";
import { getCommunicationSuppressions, isCommunicationSuppressed } from "@/lib/communication-suppressions";
import { countSmsSegments } from "@/lib/messages/cost-estimate";
import { randomUUID } from "node:crypto";
import { decideSmsSend, getSmsBalance, isSmsMetered, releaseSmsReservation, reserveSmsSegments, smsAllowanceMessage } from "@/lib/sms-allowance";
import { emailBrand, getEventBranding, smsSignature } from "@/lib/brands";
import { contactConfirmationError, CONTACT_CONFIRMATION_MESSAGE, recordGuestContactConfirmation } from "@/lib/guest-contact-confirmation";
import { getGuestEmailSender, guestEmailCompliance, guestEmailSendOptions } from "@/lib/guest-email";

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

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const auth = await requireEventPermission(eventId, 'send_messages');
    if (auth.error) return auth.error;
    const user = auth.user;

    // CASL: the host must say these guests expect to hear from them.
    if (contactConfirmationError(await request.json().catch(() => null))) {
      return NextResponse.json({ error: CONTACT_CONFIRMATION_MESSAGE }, { status: 400 });
    }

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
    const sender = await getGuestEmailSender(event, branding);
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
            eventTimezone: event.event_timezone,
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

    // Atomically claim target guests as 'pending' before sending so concurrent requests cannot double-send.
    const claimedRows = await query<{ id: string }>(
      `UPDATE guests SET invite_status = 'pending', updated_at = ${SQL_NOW}
        WHERE event_id = $1 AND invite_status IN ('not_sent', 'failed')
          AND id IN (SELECT value FROM json_each($2))
        RETURNING id`,
      [eventId, sendableGuests.map((g) => g.id)],
    );
    const claimedSet = new Set(claimedRows.map((r) => r.id));
    const claimedGuests = sendableGuests.filter((g) => claimedSet.has(g.id));
    if (claimedGuests.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, sms_sent: 0, sms_failed: 0 });
    }

    // Count against the owner's daily email allowance before anything is sent.
    const emailCount = claimedGuests.filter((guest) => guest.email).length;
    const emailQuota = await reserveEmailQuota(event.user_id, emailCount);
    if (!emailQuota.success) {
      // Release claimed rows back to not_sent/failed on quota rejection.
      await query(
        `UPDATE guests SET invite_status = 'not_sent', updated_at = ${SQL_NOW}
          WHERE event_id = $1 AND invite_status = 'pending' AND id IN (SELECT value FROM json_each($2))`,
        [eventId, claimedGuests.map((g) => g.id)],
      );
      return NextResponse.json(
        { error: emailQuotaMessage(emailCount, emailQuota.remaining, emailQuota.limit), code: "EMAIL_DAILY_LIMIT" },
        { status: 429 }
      );
    }

    await recordGuestContactConfirmation(eventId, user.id, "invites", claimedGuests.length);

    // Process all guests in parallel (batches of 10), persisting statuses per batch
    // so mid-loop timeouts or subrequest limits never leave sent guests unrecorded.
    const BATCH_SIZE = 10;
    let sent = 0;
    let failed = 0;
    let smsSent = 0;
    let smsFailed = 0;
    const successIds: string[] = [];

    for (let i = 0; i < claimedGuests.length; i += BATCH_SIZE) {
      const batch = claimedGuests.slice(i, i + BATCH_SIZE);
      const batchSuccessIds: string[] = [];
      const batchFailedIds: string[] = [];

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
            const { compliance, headers } = guestEmailCompliance(sender, guestEmail);
            const { subject, html } = buildInvitationEmail({ brand: emailBrand(branding), compliance,
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
              const result = await withRetry(() => sendEmail({ ...guestEmailSendOptions(branding, sender), headers,
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
              await query(`UPDATE guests SET phone_invalid_at = ${SQL_NOW}, updated_at = ${SQL_NOW} WHERE id = $1`, [guest.id]);
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
                eventTimezone: event.event_timezone,
                locationName: event.location_name,
                hostName: event.host_name || undefined,
                rsvpUrl,
              });
              const smsSegments = countSmsSegments(smsBody);
              const reservationRef = smsMetered ? `reserve:invite:${guest.id}:${randomUUID()}` : null;

              try {
                assertApprovedRecipient(formattedPhone);
                if (smsMetered && reservationRef) {
                  const reserved = await reserveSmsSegments(eventId, smsSegments, reservationRef);
                  if (!reserved.allowed) throw new Error("SMS allowance used up for this event");
                }
                const twilioClient = getTwilioClient();
                const result = await withRetry(() => twilioClient.messages.create({
                  body: smsBody,
                  to: formattedPhone,
                  ...getTwilioSendOptions(),
                }));
                smsOk = true;
                if (smsMetered && reservationRef) {
                  await query(
                    "UPDATE event_sms_ledger SET reference = $1 WHERE event_id = $2 AND reference = $3",
                    [`twilio:${result.sid}`, eventId, reservationRef],
                  );
                }

                // Log successful SMS
                await logSendSuccess(eventId, 'sms', formattedPhone, {
                  guestId: guest.id,
                  provider: 'twilio',
                  providerMessageId: result.sid,
                });
              } catch (error) {
                if (smsMetered && reservationRef) {
                  await releaseSmsReservation(eventId, reservationRef).catch(() => undefined);
                }
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
            batchSuccessIds.push(guestId);
          } else {
            batchFailedIds.push(guestId);
          }
        } else {
          // Promise was rejected (shouldn't happen with our try/catch, but handle just in case)
          console.error('[BATCH ERROR] Promise rejected:', result.reason);
        }
      }

      // Persist batch statuses immediately so partial progress survives timeouts.
      if (batchSuccessIds.length > 0) {
        await query(
          `UPDATE guests SET invite_status = 'sent', invite_sent_at = $1, invite_error = NULL, updated_at = ${SQL_NOW}
            WHERE id IN (SELECT value FROM json_each($2))`,
          [new Date(), batchSuccessIds],
        );
      }
      if (batchFailedIds.length > 0) {
        await query(
          `UPDATE guests SET invite_status = 'failed', invite_error = 'Delivery failed', updated_at = ${SQL_NOW}
            WHERE id IN (SELECT value FROM json_each($1))`,
          [batchFailedIds],
        );
      }
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
       VALUES ($1, $2, 'invitations_sent', $3)`,
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
