import { NextResponse } from "next/server";

import { getDb, query } from "@/lib/db/client";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, roleCan } from "@/lib/auth/event-access";
import { eventMemberInviteSchema } from "@/lib/validations";
import { generateMagicToken, hashMagicToken, previewMagicToken } from "@/lib/magic-token";
import { getTeamMemberLimit, type EventTier } from "@/lib/entitlements";
import { getUserTier } from "@/lib/subscription";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/utils";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;

  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "manage_members")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [members, invites] = await Promise.all([
    query(
      `SELECT em.id, em.user_id, em.role, em.created_at, a.email, a.name
       FROM event_members em
       JOIN admin_users a ON a.id = em.user_id
       WHERE em.event_id = $1
       ORDER BY em.created_at ASC`,
      [eventId],
    ),
    query(
      `SELECT id, email, role, token_preview, expires_at, created_at
       FROM event_member_invites
       WHERE event_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [eventId],
    ),
  ]);

  return NextResponse.json({ owner: auth.user, members, invites });
}

export async function POST(request: Request, { params }: Params) {
  const { eventId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const access = await getEventAccess(auth.user.id, eventId);
  if (!access || !roleCan(access.role, "manage_members")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = eventMemberInviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invitation", details: parsed.error.flatten() }, { status: 400 });
  }

  const token = generateMagicToken();
  const tokenHash = hashMagicToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const client = await getDb().connect();
  let eventTitle = "your event";
  try {
    await client.query("BEGIN");
    const eventResult = await client.query<{ id: string; user_id: string; title: string; tier: string }>(
      "SELECT id, user_id, title, tier FROM events WHERE id = $1 FOR UPDATE",
      [eventId],
    );
    const event = eventResult.rows[0];
    if (!event || event.user_id !== auth.user.id) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    eventTitle = event.title;

    const accountPlan = await getUserTier(auth.user.id);
    const teamLimit = getTeamMemberLimit(accountPlan, event.tier as EventTier);
    const countResult = await client.query<{ count: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM event_members WHERE event_id = $1) +
         (SELECT COUNT(*) FROM event_member_invites WHERE event_id = $1 AND accepted_at IS NULL AND expires_at > NOW())
       )::text AS count`,
      [eventId],
    );
    const occupiedSeats = 1 + Number(countResult.rows[0]?.count ?? 0);
    if (occupiedSeats >= teamLimit) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: `This event supports ${teamLimit} team member${teamLimit === 1 ? "" : "s"}, including the owner.` }, { status: 403 });
    }

    const existingUser = await client.query<{ id: string }>(
      "SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)",
      [parsed.data.email],
    );
    if (existingUser.rows[0]?.id === auth.user.id) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "You are already the event owner." }, { status: 409 });
    }
    if (existingUser.rows[0]) {
      const existingMember = await client.query(
        "SELECT id FROM event_members WHERE event_id = $1 AND user_id = $2",
        [eventId, existingUser.rows[0].id],
      );
      if (existingMember.rows[0]) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This person is already a team member." }, { status: 409 });
      }
    }

    await client.query(
      "DELETE FROM event_member_invites WHERE event_id = $1 AND LOWER(email) = LOWER($2) AND accepted_at IS NULL",
      [eventId, parsed.data.email],
    );
    await client.query(
      `INSERT INTO event_member_invites
        (event_id, email, role, token_hash, token_preview, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [eventId, parsed.data.email, parsed.data.role, tokenHash, previewMagicToken(token), auth.user.id, expiresAt.toISOString()],
    );
    await client.query(
      `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
       VALUES ($1, $2, 'member_invited', $3::jsonb)`,
      [eventId, auth.user.id, JSON.stringify({ role: parsed.data.role })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app").replace(/\/$/, "");
  const inviteUrl = `${siteUrl}/team/invite/${token}`;
  let delivery: "sent" | "failed" = "sent";
  try {
    await sendEmail({
      to: parsed.data.email,
      subject: `You were invited to help manage ${eventTitle}`,
      html: `<p>You were invited to help manage <strong>${escapeHtml(eventTitle)}</strong> on SealSend.</p><p><a href="${escapeHtml(inviteUrl)}">Accept invitation</a></p><p>This invitation expires in seven days.</p>`,
    });
  } catch {
    delivery = "failed";
  }

  return NextResponse.json({ inviteUrl, delivery, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
