import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildReminderEmail } from "@/lib/email-templates";
import { buildReminderSms } from "@/lib/sms-templates";
import { isTwilioConfigured, getTwilioClient, getTwilioSendOptions } from "@/lib/twilio";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { logSendSuccess, logSendFailure } from "@/lib/email-logger";
import { BETA_MODE } from "@/lib/constants";

/**
 * Cron job endpoint for sending automatic reminders
 * This endpoint is designed to be called by Coolify's cron feature
 * or any external cron service (e.g., cron-job.org, GitHub Actions)
 * 
 * Query params:
 * - secret: Cron secret for authentication (CRON_SECRET env var)
 * - dryRun: If true, only returns what would be sent without actually sending
 * 
 * Environment variables:
 * - CRON_SECRET: Secret key to authenticate cron requests
 * - REMINDER_HOURS_BEFORE: Hours before event to send reminders (default: 48)
 * - REMINDER_CHECK_WINDOW_HOURS: Window to check for events (default: 24)
 */

interface GuestWithResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  invite_token: string | null;
  reminder_sent_at: string | null;
  rsvp_status: string | null;
}

interface EventWithGuests {
  id: string;
  title: string;
  event_date: string;
  location_name: string | null;
  slug: string;
  tier: string;
  user_id: string;
  guests: GuestWithResponse[];
}

export async function GET(request: NextRequest) {
  try {
    // Check cron secret for authentication
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const dryRun = searchParams.get("dryRun") === "true";
    
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[CRON] CRON_SECRET environment variable not set");
      return NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 }
      );
    }
    
    if (secret !== cronSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get reminder timing configuration
    const hoursBefore = parseInt(process.env.REMINDER_HOURS_BEFORE || "48", 10);
    const checkWindowHours = parseInt(process.env.REMINDER_CHECK_WINDOW_HOURS || "24", 10);
    
    const now = new Date();
    const windowStart = new Date(now.getTime() + (hoursBefore - checkWindowHours) * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);

    console.log(`[CRON] Checking for events between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`);

    const adminSupabase = createAdminClient();

    // Find published events with auto_reminders enabled happening in the window
    const { data: events, error: eventsError } = await adminSupabase
      .from("events")
      .select(`
        id,
        title,
        event_date,
        location_name,
        slug,
        tier,
        user_id
      `)
      .eq("status", "published")
      .eq("auto_reminders", true)
      .gte("event_date", windowStart.toISOString())
      .lte("event_date", windowEnd.toISOString())
      .order("event_date", { ascending: true });

    if (eventsError) {
      console.error("[CRON] Error fetching events:", eventsError);
      return NextResponse.json(
        { error: "Failed to fetch events", details: eventsError.message },
        { status: 500 }
      );
    }

    if (!events || events.length === 0) {
      console.log("[CRON] No events found requiring reminders");
      return NextResponse.json({
        success: true,
        eventsChecked: 0,
        remindersSent: 0,
        dryRun,
        window: {
          start: windowStart.toISOString(),
          end: windowEnd.toISOString(),
        },
      });
    }

    console.log(`[CRON] Found ${events.length} events requiring reminders`);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
    const smsEnabled = isTwilioConfigured();

    const results: Array<{
      eventId: string;
      eventTitle: string;
      guestsNotified: number;
      emailsSent: number;
      smsSent: number;
      errors: string[];
    }> = [];

    // Process each event
    for (const event of events as EventWithGuests[]) {
      console.log(`[CRON] Processing event: ${event.title} (${event.id})`);

      // Fetch guests who:
      // 1. Haven't received a reminder yet (reminder_sent_at is null)
      // 2. Have either not responded OR are attending (not declined)
      const { data: guests, error: guestsError } = await adminSupabase
        .from("guests")
        .select(`
          id,
          name,
          email,
          phone,
          invite_token,
          reminder_sent_at,
          rsvp_responses!left(status)
        `)
        .eq("event_id", event.id)
        .is("reminder_sent_at", null)
        .or("email.not.is.null,phone.not.is.null");

      if (guestsError) {
        console.error(`[CRON] Error fetching guests for event ${event.id}:`, guestsError);
        results.push({
          eventId: event.id,
          eventTitle: event.title,
          guestsNotified: 0,
          emailsSent: 0,
          smsSent: 0,
          errors: [guestsError.message],
        });
        continue;
      }

      if (!guests || guests.length === 0) {
        console.log(`[CRON] No guests to notify for event ${event.id}`);
        results.push({
          eventId: event.id,
          eventTitle: event.title,
          guestsNotified: 0,
          emailsSent: 0,
          smsSent: 0,
          errors: [],
        });
        continue;
      }

      // Filter guests who haven't declined (either no response or attending/maybe)
      const guestsToNotify = guests.filter((g: GuestWithResponse & { rsvp_responses: { status: string }[] }) => {
        // If no response, include them
        if (!g.rsvp_responses || g.rsvp_responses.length === 0) return true;
        // If response is not "not_attending", include them
        return g.rsvp_responses[0]?.status !== "not_attending";
      });

      if (guestsToNotify.length === 0) {
        console.log(`[CRON] All guests have declined or been reminded for event ${event.id}`);
        results.push({
          eventId: event.id,
          eventTitle: event.title,
          guestsNotified: 0,
          emailsSent: 0,
          smsSent: 0,
          errors: [],
        });
        continue;
      }

      console.log(`[CRON] Notifying ${guestsToNotify.length} guests for event ${event.id}`);

      if (dryRun) {
        results.push({
          eventId: event.id,
          eventTitle: event.title,
          guestsNotified: guestsToNotify.length,
          emailsSent: guestsToNotify.filter((g: GuestWithResponse) => g.email).length,
          smsSent: guestsToNotify.filter((g: GuestWithResponse) => g.phone && (BETA_MODE || event.tier !== "free")).length,
          errors: [],
        });
        continue;
      }

      // Send reminders in batches
      const BATCH_SIZE = 10;
      let emailsSent = 0;
      let smsSent = 0;
      const successIds: string[] = [];
      const errors: string[] = [];

      for (let i = 0; i < guestsToNotify.length; i += BATCH_SIZE) {
        const batch = guestsToNotify.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (guest: GuestWithResponse) => {
            const rsvpUrl = guest.invite_token
              ? `${siteUrl}/e/${event.slug}?t=${guest.invite_token}`
              : `${siteUrl}/e/${event.slug}`;

            let emailOk = false;
            let smsOk = false;

            // Send email reminder
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

                await logSendSuccess(event.id, "email", guest.email, {
                  guestId: guest.id,
                  subject,
                  provider: "mailgun",
                  providerMessageId: result.id,
                  source: "cron_reminder",
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : "Email send failed";
                console.error(`[CRON] Email failed for ${guest.email}:`, message);
                await logSendFailure(event.id, "email", guest.email, message, {
                  guestId: guest.id,
                  subject: `Reminder: ${event.title}`,
                  provider: "mailgun",
                  source: "cron_reminder",
                });
              }
            }

            // Send SMS reminder (if enabled and not free tier)
            if (guest.phone && smsEnabled && (BETA_MODE || event.tier !== "free")) {
              const phoneValidation = validateAndFormatPhone(guest.phone);

              if (phoneValidation.valid && phoneValidation.formatted) {
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
                    to: phoneValidation.formatted,
                    ...getTwilioSendOptions(),
                  });
                  smsOk = true;

                  await logSendSuccess(event.id, "sms", phoneValidation.formatted, {
                    guestId: guest.id,
                    provider: "twilio",
                    providerMessageId: result.sid,
                    source: "cron_reminder",
                  });
                } catch (error) {
                  const message = error instanceof Error ? error.message : "SMS send failed";
                  console.error(`[CRON] SMS failed for ${guest.phone}:`, message);
                  await logSendFailure(event.id, "sms", guest.phone, message, {
                    guestId: guest.id,
                    provider: "twilio",
                    source: "cron_reminder",
                  });
                }
              } else {
                const errorMsg = phoneValidation.error || "Invalid phone number";
                console.error(`[CRON] Invalid phone for guest ${guest.id}:`, errorMsg);
                await logSendFailure(event.id, "sms", guest.phone, errorMsg, {
                  guestId: guest.id,
                  source: "cron_reminder",
                });
              }
            }

            return { guestId: guest.id, emailOk, smsOk };
          })
        );

        // Process batch results
        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            const { guestId, emailOk, smsOk } = result.value;
            if (emailOk || smsOk) {
              successIds.push(guestId);
              if (emailOk) emailsSent++;
              if (smsOk) smsSent++;
            }
          } else {
            errors.push(result.reason?.message || "Unknown error");
          }
        }
      }

      // Update reminder_sent_at for successful sends
      if (successIds.length > 0) {
        const { error: updateError } = await adminSupabase
          .from("guests")
          .update({ reminder_sent_at: new Date().toISOString() })
          .in("id", successIds);

        if (updateError) {
          console.error(`[CRON] Error updating reminder_sent_at for event ${event.id}:`, updateError);
          errors.push(updateError.message);
        }
      }

      results.push({
        eventId: event.id,
        eventTitle: event.title,
        guestsNotified: successIds.length,
        emailsSent,
        smsSent,
        errors,
      });

      console.log(`[CRON] Event ${event.id}: ${emailsSent} emails, ${smsSent} SMS sent`);
    }

    const totalEmails = results.reduce((sum, r) => sum + r.emailsSent, 0);
    const totalSms = results.reduce((sum, r) => sum + r.smsSent, 0);
    const totalGuests = results.reduce((sum, r) => sum + r.guestsNotified, 0);

    console.log(`[CRON] Completed: ${totalEmails} emails, ${totalSms} SMS to ${totalGuests} guests across ${events.length} events`);

    return NextResponse.json({
      success: true,
      dryRun,
      eventsChecked: events.length,
      remindersSent: totalGuests,
      emailsSent: totalEmails,
      smsSent: totalSms,
      window: {
        start: windowStart.toISOString(),
        end: windowEnd.toISOString(),
        hoursBefore,
        checkWindowHours,
      },
      results,
    });

  } catch (error) {
    console.error("[CRON] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility with some cron services
export async function POST(request: NextRequest) {
  return GET(request);
}
