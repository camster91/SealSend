import { NextResponse } from "next/server";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";
import { requireApiHost } from "@/lib/auth/api-auth";
import { query, queryOne } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { announcementSchema } from "@/lib/validations";
import { canUseFeature, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { dispatchAnnouncement } from "@/lib/messages/dispatch-announcement";
import { verifyAnnouncementApprovalProof } from "@/lib/messages/approval-proof";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "send_messages")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const announcements = await query(
    `SELECT a.*,
       (SELECT COUNT(*)::int FROM announcement_deliveries d WHERE d.announcement_id = a.id AND d.status IN ('accepted','delivered')) AS accepted_count,
       (SELECT COUNT(*)::int FROM announcement_deliveries d WHERE d.announcement_id = a.id AND d.status IN ('failed','bounced')) AS failed_count
     FROM event_announcements a WHERE a.event_id = $1 ORDER BY a.created_at DESC`, [eventId],
  );
  return NextResponse.json(announcements);
}

export async function POST(request: Request, { params }: RouteParams) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "send_messages")) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const { success: rateLimitOk } = await rateLimit(`announcements:${auth.user.id}`, { max: 10, windowSeconds: 3600 });
  if (!rateLimitOk) return NextResponse.json({ error: "Too many requests. Please wait before scheduling another message." }, { status: 429 });
  const parsed = announcementSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Review and explicitly approve the complete message, audience, channels, and schedule.", details: parsed.error.flatten() }, { status: 400 });
  const approvedInput = {
    eventId,
    userId: auth.user.id,
    subject: parsed.data.subject,
    message: parsed.data.message,
    audience: parsed.data.audience,
    channels: parsed.data.channels,
    sendAt: parsed.data.scheduledAt === "now" ? null : parsed.data.scheduledAt,
  };
  if (!verifyAnnouncementApprovalProof(approvedInput, parsed.data.approvalProof)) {
    return NextResponse.json({ error: "The reviewed message changed or the approval expired. Preview it again before sending." }, { status: 409 });
  }
  const event = await queryOne<{ id: string; user_id: string; status: string; tier: string }>(
    "SELECT id, user_id, status, tier FROM events WHERE id = $1", [eventId],
  );
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.status !== "published") return NextResponse.json({ error: "Event must be published before messaging guests" }, { status: 400 });
  const accountPlan = await getUserTier(event.user_id);
  if (!canUseFeature(accountPlan, event.tier as EventTier, "announcements")) return NextResponse.json({ error: "Announcements require an eligible plan" }, { status: 403 });
  const scheduledAt = parsed.data.scheduledAt === "now" ? new Date() : new Date(parsed.data.scheduledAt);
  if (scheduledAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "Scheduled time cannot be in the past" }, { status: 400 });
  const announcement = await queryOne<{ id: string }>(
    `INSERT INTO event_announcements
      (event_id, subject, message, audience, channels, scheduled_at, approved_at, created_by, status)
     VALUES ($1, $2, $3, $4::jsonb, $5::text[], $6, NOW(), $7, 'queued') RETURNING id`,
    [eventId, parsed.data.subject, parsed.data.message, JSON.stringify(parsed.data.audience), parsed.data.channels, scheduledAt.toISOString(), auth.user.id],
  );
  if (!announcement) return NextResponse.json({ error: "Could not queue announcement" }, { status: 500 });
  await query(
    `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
     VALUES ($1, $2, 'announcement_approved', $3::jsonb)`,
    [eventId, auth.user.id, JSON.stringify({ announcementId: announcement.id, scheduledAt: scheduledAt.toISOString(), channels: parsed.data.channels })],
  );
  await recordActivationEventSafely({
    name: "announcement_approved",
    userId: event.user_id,
    eventId,
  });
  const immediate = scheduledAt.getTime() <= Date.now() + 5_000;
  const result = immediate ? await dispatchAnnouncement(announcement.id) : null;
  const saved = await queryOne<Record<string, unknown>>("SELECT * FROM event_announcements WHERE id = $1", [announcement.id]);
  return NextResponse.json({ ...saved, dispatch: result }, { status: 201 });
}
