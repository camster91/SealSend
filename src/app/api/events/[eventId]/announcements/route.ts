import { NextRequest, NextResponse } from "next/server";
import { requireApiHost } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { buildAnnouncementEmail } from "@/lib/email-templates";
import { buildAnnouncementSms } from "@/lib/sms-templates";
import { announcementSchema } from "@/lib/validations";
import { isTwilioConfigured, getTwilioClient, getTwilioSendOptions } from "@/lib/twilio";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { logSendSuccess, logSendFailure } from "@/lib/email-logger";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(
  _request: Request,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Verify ownership
    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const announcements = await query(
      'SELECT * FROM event_announcements WHERE event_id = $1 ORDER BY created_at DESC',
      [eventId]
    );

    return NextResponse.json(announcements);
  } catch (error) {
    console.error('[ANNOUNCEMENTS GET ERROR]', error);
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
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    const { success: rateLimitOk } = await rateLimit(`announcements:${user.id}`, { max: 5, windowSeconds: 3600 });
    if (!rateLimitOk) {
      return NextResponse.json({ error: "Too many send requests. Please wait before sending again." }, { status: 429 });
    }

    // Ownership + status check
    const event = await queryOne<{ id: string; title: string; slug: string; status: string; tier: string }>(
      'SELECT id, title, slug, status, tier FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { error: "Event must be published before sending announcements" },
        { status: 400 }
      );
    }

    // Tier gate: announcements require standard or premium (unlocked in beta)
    const { BETA_MODE } = await import("@/lib/constants");
    if (!BETA_MODE && event.tier === "free") {
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
    const guests = await query<{ id: string; name: string; email: string | null; phone: string | null; invite_token: string | null }>(
      'SELECT id, name, email, phone, invite_token FROM guests WHERE event_id = $1',
      [eventId]
    );

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
              const result = await sendEmail({
                to: guest.email,
                subject,
                html,
              });
              ok = true;

              await logSendSuccess(eventId, 'email', guest.email, {
                guestId: guest.id,
                subject,
                provider: 'mailgun',
                providerMessageId: result.id,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Email send failed';
              console.error(`[ANNOUNCEMENT EMAIL FAILED] ${guest.email}:`, message);

              await logSendFailure(eventId, 'email', guest.email, message, {
                guestId: guest.id,
                subject: parsed.data.subject,
                provider: 'mailgun',
              });
            }
          }

          if (guest.phone && smsEnabled) {
            // Validate and format phone number
            const phoneValidation = validateAndFormatPhone(guest.phone);

            if (!phoneValidation.valid) {
              console.error(`[ANNOUNCEMENT SMS INVALID] ${guest.phone}:`, phoneValidation.error);

              await logSendFailure(eventId, 'sms', guest.phone, phoneValidation.error || 'Invalid phone', {
                guestId: guest.id,
              });
            } else {
              const formattedPhone = phoneValidation.formatted!;
              const smsBody = buildAnnouncementSms({
                guestName: guest.name,
                eventTitle: event.title,
                subject: parsed.data.subject,
                rsvpUrl,
              });

              try {
                const twilioClient = getTwilioClient();
                const result = await twilioClient.messages.create({
                  body: smsBody,
                  to: formattedPhone,
                  ...getTwilioSendOptions(),
                });
                ok = true;

                await logSendSuccess(eventId, 'sms', formattedPhone, {
                  guestId: guest.id,
                  provider: 'twilio',
                  providerMessageId: result.sid,
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : 'SMS send failed';
                console.error(`[ANNOUNCEMENT SMS FAILED] ${guest.phone}:`, message);

                await logSendFailure(eventId, 'sms', guest.phone, message, {
                  guestId: guest.id,
                  provider: 'twilio',
                });
              }
            }
          }

          return ok;
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) sentCount++;
      }
    }

    // Save the announcement record
    const announcement = await queryOne(
      `INSERT INTO event_announcements (event_id, subject, message, sent_to_count)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [eventId, parsed.data.subject, parsed.data.message, sentCount]
    );

    if (!announcement) {
      return NextResponse.json({ error: "Failed to insert announcement" }, { status: 500 });
    }

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    console.error('[ANNOUNCEMENT POST ERROR]', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
