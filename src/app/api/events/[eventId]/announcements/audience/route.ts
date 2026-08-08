import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { query } from "@/lib/db/client";
import { buildAudienceQuery, messageAudienceSchema } from "@/lib/messages/audience";
import { z } from "zod";
import { estimateDeliveryCost } from "@/lib/messages/cost-estimate";

const previewSchema = z.object({ audience: messageAudienceSchema, channels: z.array(z.enum(["email", "sms"])).min(1).max(2) }).strict();

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
  if (!parsed.success) return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  const audience = buildAudienceQuery(eventId, parsed.data.audience);
  const recipients = await query<{ id: string; name: string; email: string | null; phone: string | null }>(audience.sql, audience.params);
  const resolvedRecipients = recipients.filter((recipient) => (parsed.data.channels.includes("email") && recipient.email) || (parsed.data.channels.includes("sms") && recipient.phone));
  const cost = estimateDeliveryCost(resolvedRecipients, parsed.data.channels, {
    emailMicros: process.env.EMAIL_ESTIMATED_COST_MICROS,
    smsMicros: process.env.SMS_ESTIMATED_COST_MICROS,
  });
  return NextResponse.json({
    count: resolvedRecipients.length,
    emailCount: cost.emailCount,
    smsCount: cost.smsCount,
    recipients: resolvedRecipients.slice(0, 100).map(({ id, name, email, phone }) => ({ id, name, channels: [...(parsed.data.channels.includes("email") && email ? ["email"] : []), ...(parsed.data.channels.includes("sms") && phone ? ["sms"] : [])] })),
    truncated: resolvedRecipients.length > 100,
    estimatedCostMicros: cost.estimatedCostMicros,
    costConfigured: cost.costConfigured,
  });
}
