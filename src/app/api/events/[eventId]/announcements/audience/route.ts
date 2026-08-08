import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { query } from "@/lib/db/client";
import { buildAudienceQuery, messageAudienceSchema } from "@/lib/messages/audience";

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
  const parsed = messageAudienceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  const audience = buildAudienceQuery(eventId, parsed.data);
  const recipients = await query<{ id: string; name: string; email: string | null; phone: string | null }>(audience.sql, audience.params);
  return NextResponse.json({
    count: recipients.length,
    emailCount: recipients.filter((recipient) => recipient.email).length,
    smsCount: recipients.filter((recipient) => recipient.phone).length,
    recipients: recipients.slice(0, 100).map(({ id, name, email, phone }) => ({ id, name, channels: [...(email ? ["email"] : []), ...(phone ? ["sms"] : [])] })),
    truncated: recipients.length > 100,
  });
}
