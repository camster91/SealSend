import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { getDb } from "@/lib/db/client";
import { hashMagicToken, isValidMagicToken } from "@/lib/magic-token";

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  if (!auth.user.email || !isValidMagicToken(token)) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
  }

  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const invite = (await client.query<{ id: string; organization_id: string; role: string }>(
      `SELECT id, organization_id, role FROM organization_invites
        WHERE token_hash = $1 AND LOWER(email) = LOWER($2) AND accepted_at IS NULL AND expires_at > NOW()
        FOR UPDATE`,
      [hashMagicToken(token), auth.user.email],
    )).rows[0];
    if (!invite) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Invitation is invalid, expired, or belongs to another account." }, { status: 404 });
    }
    // Accepting never demotes an existing member (e.g. an owner who re-accepts an old invite).
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [invite.organization_id, auth.user.id, invite.role],
    );
    await client.query("UPDATE organization_invites SET accepted_at = NOW(), accepted_by = $1 WHERE id = $2", [auth.user.id, invite.id]);
    await client.query("COMMIT");
    return NextResponse.json({ success: true, organizationId: invite.organization_id });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
