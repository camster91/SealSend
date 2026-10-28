import { NextResponse } from "next/server";

import { batch, query, queryOne } from "@/lib/db/client";
import { abortCode, guard, SQL_NOW, type Statement } from "@/lib/db/sqlite-dialect";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getEventAccess, resolveEventAccessRole, roleCan } from "@/lib/auth/event-access";
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
       WHERE event_id = $1 AND accepted_at IS NULL AND expires_at > ${SQL_NOW}
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
  // Re-check the resolved permission at write time. A role can be removed
  // after the initial lookup; the UI permission must never outlive that
  // membership change. D1 has no row locks, so the batch below re-checks the
  // roles read here, the seat count and the membership before it writes.
  const event = await queryOne<{
    id: string;
    user_id: string;
    title: string;
    tier: string;
    role: string | null;
    organization_role: string | null;
  }>(
    `SELECT e.id, e.user_id, e.title, e.tier,
            CASE WHEN e.user_id = $2 THEN 'owner'
                 ELSE (SELECT em.role FROM event_members em WHERE em.event_id = e.id AND em.user_id = $2 LIMIT 1)
            END AS role,
            (SELECT om.role FROM organization_members om WHERE om.organization_id = e.organization_id AND om.user_id = $2 LIMIT 1) AS organization_role
       FROM events e
      WHERE e.id = $1
        AND (e.user_id = $2
             OR EXISTS (SELECT 1 FROM event_members em WHERE em.event_id = e.id AND em.user_id = $2)
             OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = e.organization_id AND om.user_id = $2))`,
    [eventId, auth.user.id],
  );
  const transactionRole = event
    ? resolveEventAccessRole(event.role, event.organization_role)
    : null;
  if (!event || !transactionRole || !roleCan(transactionRole, "manage_members")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const eventTitle = event.title;

  // Seat entitlement belongs to the event owner, even when a workspace
  // owner or admin performs the invite on a planner-created event.
  const accountPlan = await getUserTier(event.user_id);
  const teamLimit = getTeamMemberLimit(accountPlan, event.tier as EventTier);
  const seatLimitResponse = () => NextResponse.json({ error: `This event supports ${teamLimit} team member${teamLimit === 1 ? "" : "s"}, including the owner.` }, { status: 403 });
  const occupiedSeatsSql = `1 + (SELECT COUNT(*) FROM event_members WHERE event_id = $1) +
       (SELECT COUNT(*) FROM event_member_invites WHERE event_id = $1 AND accepted_at IS NULL AND expires_at > ${SQL_NOW})`;
  const countResult = await queryOne<{ count: number }>(
    `SELECT ${occupiedSeatsSql} AS count`,
    [eventId],
  );
  const occupiedSeats = Number(countResult?.count ?? 1);
  if (occupiedSeats >= teamLimit) {
    return seatLimitResponse();
  }

  const existingUser = await queryOne<{ id: string }>(
    "SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)",
    [parsed.data.email],
  );
  if (existingUser?.id === auth.user.id) {
    return NextResponse.json({ error: "You are already the event owner." }, { status: 409 });
  }
  const alreadyMemberResponse = () => NextResponse.json({ error: "This person is already a team member." }, { status: 409 });
  if (existingUser) {
    const existingMember = await queryOne(
      "SELECT id FROM event_members WHERE event_id = $1 AND user_id = $2",
      [eventId, existingUser.id],
    );
    if (existingMember) {
      return alreadyMemberResponse();
    }
  }

  const statements: Statement[] = [
    // The roles that granted manage_members are unchanged.
    guard(
      `EXISTS (SELECT 1 FROM events e WHERE e.id = $1
          AND (CASE WHEN e.user_id = $2 THEN 'owner'
                    ELSE (SELECT em.role FROM event_members em WHERE em.event_id = e.id AND em.user_id = $2 LIMIT 1)
               END) IS $3
          AND (SELECT om.role FROM organization_members om WHERE om.organization_id = e.organization_id AND om.user_id = $2 LIMIT 1) IS $4)`,
      [eventId, auth.user.id, event.role, event.organization_role],
      "access_changed",
    ),
    guard(`${occupiedSeatsSql} < $2`, [eventId, teamLimit], "seat_limit"),
  ];
  if (existingUser) {
    statements.push(guard(
      "NOT EXISTS (SELECT 1 FROM event_members WHERE event_id = $1 AND user_id = $2)",
      [eventId, existingUser.id],
      "already_member",
    ));
  }
  statements.push(
    {
      text: "DELETE FROM event_member_invites WHERE event_id = $1 AND LOWER(email) = LOWER($2) AND accepted_at IS NULL",
      params: [eventId, parsed.data.email],
    },
    {
      text: `INSERT INTO event_member_invites
        (event_id, email, role, token_hash, token_preview, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      params: [eventId, parsed.data.email, parsed.data.role, tokenHash, previewMagicToken(token), auth.user.id, expiresAt],
    },
    {
      text: `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
       VALUES ($1, $2, 'member_invited', $3)`,
      params: [eventId, auth.user.id, JSON.stringify({ role: parsed.data.role })],
    },
  );
  try {
    await batch(statements);
  } catch (error) {
    const code = abortCode(error);
    if (code === "access_changed") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "seat_limit") return seatLimitResponse();
    if (code === "already_member") return alreadyMemberResponse();
    throw error;
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
