import { batch, query, queryOne } from "@/lib/db/client";
import { abortCode, guard, SQL_NOW, type Statement } from "@/lib/db/sqlite-dialect";
import { buildAudienceQuery, messageAudienceSchema } from "@/lib/messages/audience";
import { sendEmail } from "@/lib/email";
import { buildAnnouncementEmail } from "@/lib/email-templates";
import { buildAnnouncementSms } from "@/lib/sms-templates";
import { getTwilioClient, getTwilioSendOptions, isTwilioConfigured } from "@/lib/twilio";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { assertApprovedRecipient } from "@/lib/communications-safety";
import { reserveEmailQuota } from "@/lib/email-quota";
import { getCommunicationSuppressions, isCommunicationSuppressed } from "@/lib/communication-suppressions";
import { countSmsSegments } from "@/lib/messages/cost-estimate";
import { getSmsBalance, isSmsMetered, recordSmsUsage } from "@/lib/sms-allowance";
import { getUserTier } from "@/lib/subscription";
import { emailBrand, getEventBranding, smsSignature } from "@/lib/brands";
import { getGuestEmailSender, guestEmailCompliance, guestEmailSendOptions } from "@/lib/guest-email";

type Announcement = {
  id: string; event_id: string; subject: string; message: string; audience: unknown; channels: string[];
  title: string; slug: string; user_id: string; tier: string; host_name: string | null;
};
type Recipient = { id: string; name: string; email: string | null; phone: string | null; phone_invalid_at: string | null; invite_token: string | null };
type Delivery = { id: string; guest_id: string; channel: "email" | "sms"; recipient: string; name: string; invite_token: string | null };
type PlannedDelivery = { guest_id: string; channel: "email" | "sms"; recipient: string };

// Rows per INSERT ... SELECT FROM json_each, so each statement's bound JSON stays small.
const DELIVERY_INSERT_CHUNK = 500;

export async function dispatchAnnouncement(announcementId: string) {
  const announcement = await queryOne<Announcement>(
    `SELECT a.id, a.event_id, a.subject, a.message, a.audience, a.channels, e.title, e.slug, e.user_id, e.tier, e.host_name
     FROM event_announcements a JOIN events e ON e.id = a.event_id
     WHERE a.id = $1 AND a.status = 'queued' AND a.approved_at IS NOT NULL AND a.scheduled_at <= ${SQL_NOW}`, [announcementId],
  );
  if (!announcement) return { dispatched: false, sent: 0, failed: 0 };
  const suppressions = await getCommunicationSuppressions(announcement.user_id);
  const audience = messageAudienceSchema.parse(announcement.audience);
  const audienceQuery = buildAudienceQuery(announcement.event_id, audience);
  const recipients = await query<Recipient>(audienceQuery.sql, audienceQuery.params);
  const planned: PlannedDelivery[] = [];
  for (const guest of recipients) {
    if (announcement.channels.includes("email") && guest.email && !isCommunicationSuppressed(suppressions, "email", guest.email)) {
      planned.push({ guest_id: guest.id, channel: "email", recipient: guest.email });
    }
    // No SMS deliveries while Twilio is off, so an email+SMS announcement isn't reported as failed.
    if (announcement.channels.includes("sms") && isTwilioConfigured() && guest.phone && !guest.phone_invalid_at) {
      const phone = validateAndFormatPhone(guest.phone);
      if (phone.valid && phone.formatted && isCommunicationSuppressed(suppressions, "sms", phone.formatted)) continue;
      planned.push({ guest_id: guest.id, channel: "sms", recipient: guest.phone });
    }
  }
  const inserts: Statement[] = [];
  for (let index = 0; index < planned.length; index += DELIVERY_INSERT_CHUNK) {
    inserts.push({
      // Joined to guests so a guest deleted since the audience read is skipped instead of failing the batch.
      text: `INSERT INTO announcement_deliveries (announcement_id, guest_id, channel, recipient)
        SELECT $1, g.id, json_extract(planned.value, '$.channel'), json_extract(planned.value, '$.recipient')
          FROM json_each($2) planned
          JOIN guests g ON g.id = json_extract(planned.value, '$.guest_id') AND g.event_id = $3
         WHERE true
        ON CONFLICT (announcement_id, guest_id, channel) DO NOTHING`,
      params: [announcementId, planned.slice(index, index + DELIVERY_INSERT_CHUNK), announcement.event_id],
    });
  }
  // Claim and queue in one batch. The guard re-checks the announcement inside the batch, so of two
  // overlapping runs only the first moves it to 'processing'; the other aborts and sends nothing.
  try {
    await batch([
      guard(
        `EXISTS (SELECT 1 FROM event_announcements
          WHERE id = $1 AND status = 'queued' AND approved_at IS NOT NULL AND scheduled_at <= ${SQL_NOW})`,
        [announcementId],
        "announcement_not_queued",
      ),
      { text: "UPDATE event_announcements SET status = 'processing', attempt_count = attempt_count + 1 WHERE id = $1", params: [announcementId] },
      ...inserts,
    ]);
  } catch (error) {
    if (abortCode(error) === "announcement_not_queued") return { dispatched: false, sent: 0, failed: 0 };
    throw error;
  }

  const deliveries = await query<Delivery>(
    `SELECT d.id, d.guest_id, d.channel, d.recipient, g.name, g.invite_token
     FROM announcement_deliveries d JOIN guests g ON g.id = d.guest_id
     WHERE d.announcement_id = $1 AND d.status = 'queued' ORDER BY d.created_at`, [announcementId],
  );
  let sent = 0;
  let failed = 0;
  const smsMetered = deliveries.some((delivery) => delivery.channel === "sms")
    && isSmsMetered(await getUserTier(announcement.user_id), announcement.tier);
  let smsBalance = smsMetered ? await getSmsBalance(announcement.event_id) : Number.POSITIVE_INFINITY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
  const branding = await getEventBranding(announcement.event_id);
  const sender = await getGuestEmailSender({ id: announcement.event_id, user_id: announcement.user_id, host_name: announcement.host_name }, branding);
  for (const delivery of deliveries) {
    if (delivery.channel === "email" && isCommunicationSuppressed(suppressions, "email", delivery.recipient)) {
      await query(`UPDATE announcement_deliveries SET status = 'opted_out', error = NULL, updated_at = ${SQL_NOW} WHERE id = $1`, [delivery.id]);
      continue;
    }
    const claimed = await queryOne<{ id: string }>(
      `UPDATE announcement_deliveries SET status = 'sending', updated_at = ${SQL_NOW} WHERE id = $1 AND status = 'queued' RETURNING id`, [delivery.id],
    );
    if (!claimed) continue;
    const rsvpUrl = delivery.invite_token ? `${siteUrl}/e/${announcement.slug}?t=${delivery.invite_token}` : `${siteUrl}/e/${announcement.slug}`;
    try {
      let providerMessageId: string;
      if (delivery.channel === "email") {
        if (!(await reserveEmailQuota(announcement.user_id, 1)).success) throw new Error("Daily email limit reached for this account");
        const { compliance, headers } = guestEmailCompliance(sender, delivery.recipient);
        const content = buildAnnouncementEmail({ brand: emailBrand(branding), compliance, guestName: delivery.name, eventTitle: announcement.title, announcementSubject: announcement.subject, announcementMessage: announcement.message, rsvpUrl });
        providerMessageId = (await sendEmail({ ...guestEmailSendOptions(branding, sender), headers, to: delivery.recipient, subject: content.subject, html: content.html })).id;
      } else {
        if (!isTwilioConfigured()) throw new Error("Twilio is not configured");
        const phone = validateAndFormatPhone(delivery.recipient);
        if (!phone.valid || !phone.formatted) {
          await query(`UPDATE guests SET phone_invalid_at = ${SQL_NOW}, updated_at = ${SQL_NOW} WHERE id = $1`, [delivery.guest_id]);
          throw new Error(phone.error || "Invalid phone number");
        }
        if (isCommunicationSuppressed(suppressions, "sms", phone.formatted)) {
          await query(`UPDATE announcement_deliveries SET status = 'opted_out', error = NULL, updated_at = ${SQL_NOW} WHERE id = $1`, [delivery.id]);
          continue;
        }
        assertApprovedRecipient(phone.formatted);
        const body = buildAnnouncementSms({ signature: smsSignature(branding), guestName: delivery.name, eventTitle: announcement.title, subject: announcement.subject, message: announcement.message, rsvpUrl });
        const segments = countSmsSegments(body);
        if (segments > smsBalance) throw new Error("SMS allowance used up for this event");
        smsBalance -= segments;
        try {
          providerMessageId = (await getTwilioClient().messages.create({ body, to: phone.formatted, ...getTwilioSendOptions() })).sid;
        } catch (error) {
          smsBalance += segments;
          throw error;
        }
        if (smsMetered) await recordSmsUsage(announcement.event_id, segments, `twilio:${providerMessageId}`);
      }
      await query(`UPDATE announcement_deliveries SET status = 'accepted', provider_message_id = $2, error = NULL, updated_at = ${SQL_NOW} WHERE id = $1`, [delivery.id, providerMessageId]);
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delivery failed";
      await query(`UPDATE announcement_deliveries SET status = 'failed', error = $2, updated_at = ${SQL_NOW} WHERE id = $1`, [delivery.id, message.slice(0, 1000)]);
      failed++;
    }
  }
  const status = failed === 0 ? "sent" : sent > 0 ? "partially_failed" : "failed";
  await query(
    `UPDATE event_announcements SET status = $2, sent_to_count = $3, dispatched_at = ${SQL_NOW}, last_error = $4 WHERE id = $1`,
    [announcementId, status, sent, failed ? `${failed} delivery attempt(s) failed` : null],
  );
  return { dispatched: true, sent, failed };
}
