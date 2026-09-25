import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, query, queryOne } from "@/lib/db/client";
import {
  INVITABLE_ORGANIZATION_ROLES,
  canManageMemberRole,
  organizationSeatLimit,
  requireOrganizationPermission,
} from "@/lib/auth/organization-access";
import { generateMagicToken, hashMagicToken, previewMagicToken } from "@/lib/magic-token";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ organizationId: string }> };

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(INVITABLE_ORGANIZATION_ROLES),
}).strict();

export async function GET(_request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "view_organization");
  if (auth.error) return auth.error;

  const organization = await queryOne<{ name: string; plan: string; is_personal: boolean }>(
    "SELECT name, plan, is_personal FROM organizations WHERE id = $1",
    [organizationId],
  );
  const members = await query<{ user_id: string; email: string; name: string | null; role: string; created_at: string }>(
    `SELECT m.user_id, u.email, u.name, m.role, m.created_at
       FROM organization_members m JOIN admin_users u ON u.id = m.user_id
      WHERE m.organization_id = $1
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'planner' THEN 2 ELSE 3 END, u.email`,
    [organizationId],
  );
  const canManage = auth.role === "owner" || auth.role === "admin";
  const invites = canManage
    ? await query<{ id: string; email: string; role: string; expires_at: string }>(
        `SELECT id, email, role, expires_at FROM organization_invites
          WHERE organization_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
          ORDER BY created_at DESC`,
        [organizationId],
      )
    : [];

  return NextResponse.json(
    { organization, members, invites, viewerRole: auth.role, seatLimit: organizationSeatLimit(organization?.plan ?? "personal") },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const auth = await requireOrganizationPermission(organizationId, "manage_members");
  if (auth.error) return auth.error;

  const { success } = await rateLimit(`workspace-invite:${auth.user.id}`, { max: 20, windowSeconds: 3600 });
  if (!success) return NextResponse.json({ error: "Too many invitations. Please try again later." }, { status: 429 });

  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and role." }, { status: 400 });
  if (!canManageMemberRole(auth.role, parsed.data.role)) {
    return NextResponse.json({ error: "Only workspace owners can invite admins." }, { status: 403 });
  }

  const token = generateMagicToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const client = await getDb().connect();
  let organizationName = "a workspace";
  try {
    await client.query("BEGIN");
    const organization = (await client.query<{ name: string; plan: string; is_personal: boolean }>(
      "SELECT name, plan, is_personal FROM organizations WHERE id = $1 FOR UPDATE",
      [organizationId],
    )).rows[0];
    if (!organization) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (organization.is_personal) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Create a team workspace to invite people. Personal workspaces have one member." }, { status: 400 });
    }
    organizationName = organization.name;

    const seats = await client.query<{ count: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1) +
         (SELECT COUNT(*) FROM organization_invites WHERE organization_id = $1 AND accepted_at IS NULL AND expires_at > NOW() AND LOWER(email) <> LOWER($2))
       )::text AS count`,
      [organizationId, parsed.data.email],
    );
    const limit = organizationSeatLimit(organization.plan);
    if (Number(seats.rows[0]?.count ?? 0) >= limit) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: `This workspace has ${limit} seats, including pending invitations.` }, { status: 403 });
    }

    const existingMember = await client.query(
      `SELECT 1 FROM organization_members m JOIN admin_users u ON u.id = m.user_id
        WHERE m.organization_id = $1 AND LOWER(u.email) = LOWER($2)`,
      [organizationId, parsed.data.email],
    );
    if (existingMember.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This person is already a member." }, { status: 409 });
    }

    await client.query(
      "DELETE FROM organization_invites WHERE organization_id = $1 AND LOWER(email) = LOWER($2) AND accepted_at IS NULL",
      [organizationId, parsed.data.email],
    );
    await client.query(
      `INSERT INTO organization_invites (organization_id, email, role, token_hash, token_preview, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [organizationId, parsed.data.email, parsed.data.role, hashMagicToken(token), previewMagicToken(token), auth.user.id, expiresAt.toISOString()],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app").replace(/\/$/, "");
  const inviteUrl = `${siteUrl}/team/workspace/${token}`;
  let delivery: "sent" | "failed" = "sent";
  try {
    await sendEmail({
      to: parsed.data.email,
      subject: `You were invited to join ${organizationName} on SealSend`,
      html: `<p>You were invited to join the <strong>${escapeHtml(organizationName)}</strong> workspace on SealSend.</p><p><a href="${escapeHtml(inviteUrl)}">Accept invitation</a></p><p>This invitation expires in seven days.</p>`,
    });
  } catch {
    delivery = "failed";
  }
  return NextResponse.json({ inviteUrl, delivery, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
