import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { query, queryOne } from "@/lib/db/client";
import { buildAudienceQuery, messageAudienceSchema } from "@/lib/messages/audience";
import { z } from "zod";
import { countSmsSegments, estimateDeliveryCost } from "@/lib/messages/cost-estimate";
import { buildAnnouncementSms } from "@/lib/sms-templates";
import { createAnnouncementApprovalProof } from "@/lib/messages/approval-proof";
import { getEventBranding, smsSignature } from "@/lib/brands";

const previewSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  sendAt: z.string().datetime({ offset: true }).nullable(),
  audience: messageAudienceSchema,
  channels: z.array(z.enum(["email", "sms"])).min(1).max(2),
}).strict();

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "send_messages")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tags = await query<{ id: string; tag_name: string; color: string }>(
    "SELECT id, tag_name, color FROM guest_tags WHERE event_id = $1 ORDER BY tag_name", [eventId],
  );
  return NextResponse.json({ tags });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "send_messages")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Review the message content, audience, and channels before previewing." }, { status: 400 });
  const event = await queryOne<{ title: string; slug: string }>("SELECT title, slug FROM events WHERE id = $1", [eventId]);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const branding = await getEventBranding(eventId);
  const audience = buildAudienceQuery(eventId, parsed.data.audience);
  const recipients = await query<{ id: string; name: string; email: string | null; phone: string | null; invite_token: string | null }>(audience.sql, audience.params);
  const resolvedRecipients = recipients.filter((recipient) => (parsed.data.channels.includes("email") && recipient.email) || (parsed.data.channels.includes("sms") && recipient.phone));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
  const costRecipients = resolvedRecipients.map((recipient) => ({
    ...recipient,
    smsSegments: recipient.phone && parsed.data.channels.includes("sms")
      ? countSmsSegments(buildAnnouncementSms({ signature: smsSignature(branding),
          guestName: recipient.name,
          eventTitle: event.title,
          subject: parsed.data.subject,
          message: parsed.data.message,
          rsvpUrl: recipient.invite_token ? `${siteUrl}/e/${event.slug}?t=${recipient.invite_token}` : `${siteUrl}/e/${event.slug}`,
        }))
      : undefined,
  }));
  const cost = estimateDeliveryCost(costRecipients, parsed.data.channels, {
    emailMicros: process.env.EMAIL_ESTIMATED_COST_MICROS,
    smsMicros: process.env.SMS_ESTIMATED_COST_MICROS,
  });
  return NextResponse.json({
    count: resolvedRecipients.length,
    emailCount: cost.emailCount,
    smsCount: cost.smsCount,
    smsSegmentCount: cost.smsSegmentCount,
    approvalProof: createAnnouncementApprovalProof({
      eventId,
      userId: auth.user.id,
      subject: parsed.data.subject,
      message: parsed.data.message,
      audience: parsed.data.audience,
      channels: parsed.data.channels,
      sendAt: parsed.data.sendAt,
    }),
    recipients: resolvedRecipients.slice(0, 100).map(({ id, name, email, phone }) => ({ id, name, channels: [...(parsed.data.channels.includes("email") && email ? ["email"] : []), ...(parsed.data.channels.includes("sms") && phone ? ["sms"] : [])] })),
    truncated: resolvedRecipients.length > 100,
    estimatedCostMicros: cost.estimatedCostMicros,
    costConfigured: cost.costConfigured,
  });
}
