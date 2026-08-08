import { getDb, query, queryOne } from "@/lib/db/client";
import { buildAudienceQuery, messageAudienceSchema } from "@/lib/messages/audience";
import { sendEmail } from "@/lib/email";
import { buildAnnouncementEmail } from "@/lib/email-templates";
import { buildAnnouncementSms } from "@/lib/sms-templates";
import { getTwilioClient, getTwilioSendOptions, isTwilioConfigured } from "@/lib/twilio";
import { validateAndFormatPhone } from "@/lib/phone-validation";
import { assertApprovedRecipient } from "@/lib/communications-safety";

type Announcement = {
  id: string; event_id: string; subject: string; message: string; audience: unknown; channels: string[];
  title: string; slug: string;
};
type Recipient = { id: string; name: string; email: string | null; phone: string | null; invite_token: string | null };
type Delivery = { id: string; guest_id: string; channel: "email" | "sms"; recipient: string; name: string; invite_token: string | null };

export async function dispatchAnnouncement(announcementId: string) {
  const client = await getDb().connect();
  let announcement: Announcement | null = null;
  try {
    await client.query("BEGIN");
    const claimed = await client.query<Announcement>(
      `SELECT a.id, a.event_id, a.subject, a.message, a.audience, a.channels, e.title, e.slug
       FROM event_announcements a JOIN events e ON e.id = a.event_id
       WHERE a.id = $1 AND a.status = 'queued' AND a.approved_at IS NOT NULL AND a.scheduled_at <= NOW()
       FOR UPDATE`, [announcementId],
    );
    announcement = claimed.rows[0] ?? null;
    if (!announcement) { await client.query("ROLLBACK"); return { dispatched: false, sent: 0, failed: 0 }; }
    await client.query("UPDATE event_announcements SET status = 'processing', attempt_count = attempt_count + 1 WHERE id = $1", [announcementId]);
    const audience = messageAudienceSchema.parse(announcement.audience);
    const audienceQuery = buildAudienceQuery(announcement.event_id, audience);
    const recipients = (await client.query<Recipient>(audienceQuery.sql, audienceQuery.params)).rows;
    for (const guest of recipients) {
      if (announcement.channels.includes("email") && guest.email) {
        await client.query(`INSERT INTO announcement_deliveries (announcement_id, guest_id, channel, recipient)
          VALUES ($1, $2, 'email', $3) ON CONFLICT (announcement_id, guest_id, channel) DO NOTHING`, [announcement.id, guest.id, guest.email]);
      }
      if (announcement.channels.includes("sms") && guest.phone) {
        await client.query(`INSERT INTO announcement_deliveries (announcement_id, guest_id, channel, recipient)
          VALUES ($1, $2, 'sms', $3) ON CONFLICT (announcement_id, guest_id, channel) DO NOTHING`, [announcement.id, guest.id, guest.phone]);
      }
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }

  const deliveries = await query<Delivery>(
    `SELECT d.id, d.guest_id, d.channel, d.recipient, g.name, g.invite_token
     FROM announcement_deliveries d JOIN guests g ON g.id = d.guest_id
     WHERE d.announcement_id = $1 AND d.status = 'queued' ORDER BY d.created_at`, [announcementId],
  );
  let sent = 0;
  let failed = 0;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
  for (const delivery of deliveries) {
    const claimed = await queryOne<{ id: string }>(
      "UPDATE announcement_deliveries SET status = 'sending', updated_at = NOW() WHERE id = $1 AND status = 'queued' RETURNING id", [delivery.id],
    );
    if (!claimed) continue;
    const rsvpUrl = delivery.invite_token ? `${siteUrl}/e/${announcement.slug}?t=${delivery.invite_token}` : `${siteUrl}/e/${announcement.slug}`;
    try {
      let providerMessageId: string;
      if (delivery.channel === "email") {
        const content = buildAnnouncementEmail({ guestName: delivery.name, eventTitle: announcement.title, announcementSubject: announcement.subject, announcementMessage: announcement.message, rsvpUrl });
        providerMessageId = (await sendEmail({ to: delivery.recipient, subject: content.subject, html: content.html })).id;
      } else {
        if (!isTwilioConfigured()) throw new Error("Twilio is not configured");
        const phone = validateAndFormatPhone(delivery.recipient);
        if (!phone.valid || !phone.formatted) throw new Error(phone.error || "Invalid phone number");
        assertApprovedRecipient(phone.formatted);
        const body = buildAnnouncementSms({ guestName: delivery.name, eventTitle: announcement.title, subject: announcement.subject, rsvpUrl });
        providerMessageId = (await getTwilioClient().messages.create({ body, to: phone.formatted, ...getTwilioSendOptions() })).sid;
      }
      await query("UPDATE announcement_deliveries SET status = 'accepted', provider_message_id = $2, error = NULL, updated_at = NOW() WHERE id = $1", [delivery.id, providerMessageId]);
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delivery failed";
      await query("UPDATE announcement_deliveries SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1", [delivery.id, message.slice(0, 1000)]);
      failed++;
    }
  }
  const status = failed === 0 ? "sent" : sent > 0 ? "partially_failed" : "failed";
  await query(
    "UPDATE event_announcements SET status = $2, sent_to_count = $3, dispatched_at = NOW(), last_error = $4 WHERE id = $1",
    [announcementId, status, sent, failed ? `${failed} delivery attempt(s) failed` : null],
  );
  return { dispatched: true, sent, failed };
}
