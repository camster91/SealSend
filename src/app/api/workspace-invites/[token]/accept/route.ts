import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { batch, queryOne } from "@/lib/db/client";
import { SQL_NOW, abortCode, guard } from "@/lib/db/sqlite-dialect";
import { hashMagicToken, isValidMagicToken } from "@/lib/magic-token";

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  if (!auth.user.email || !isValidMagicToken(token)) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
  }

  const invalid = () => NextResponse.json({ error: "Invitation is invalid, expired, or belongs to another account." }, { status: 404 });
  const invite = await queryOne<{ id: string; organization_id: string; role: string }>(
    `SELECT id, organization_id, role FROM organization_invites
      WHERE token_hash = $1 AND LOWER(email) = LOWER($2) AND accepted_at IS NULL AND expires_at > ${SQL_NOW}`,
    [hashMagicToken(token), auth.user.email],
  );
  if (!invite) return invalid();

  try {
    await batch([
      // One-time token: the guard re-checks the invite inside the batch, so a parallel accept loses.
      guard(
        `EXISTS (SELECT 1 FROM organization_invites WHERE id = $1 AND accepted_at IS NULL AND expires_at > ${SQL_NOW})`,
        [invite.id],
        "invite_used",
      ),
      // Accepting never demotes an existing member (e.g. an owner who re-accepts an old invite).
      {
        text: `INSERT INTO organization_members (organization_id, user_id, role)
               VALUES ($1, $2, $3)
               ON CONFLICT (organization_id, user_id) DO NOTHING`,
        params: [invite.organization_id, auth.user.id, invite.role],
      },
      {
        text: `UPDATE organization_invites SET accepted_at = ${SQL_NOW}, accepted_by = $1 WHERE id = $2`,
        params: [auth.user.id, invite.id],
      },
    ]);
  } catch (error) {
    if (abortCode(error) === "invite_used") return invalid();
    throw error;
  }
  return NextResponse.json({ success: true, organizationId: invite.organization_id });
}
