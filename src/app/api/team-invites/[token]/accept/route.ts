import { NextResponse } from "next/server";

import { requireApiHost } from "@/lib/auth/api-auth";
import { batch, queryOne } from "@/lib/db/client";
import { SQL_NOW, abortCode, guard } from "@/lib/db/sqlite-dialect";
import { hashMagicToken, isValidMagicToken } from "@/lib/magic-token";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  if (!auth.user.email || !isValidMagicToken(token)) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
  }

  const invalid = () => NextResponse.json({ error: "Invitation is invalid, expired, or belongs to another account." }, { status: 404 });
  const invite = await queryOne<{
    id: string;
    event_id: string;
    role: "manager" | "check_in" | "viewer";
    invited_by: string;
  }>(
    `SELECT i.id, i.event_id, i.role, i.invited_by
     FROM event_member_invites i
     JOIN events e ON e.id = i.event_id
     WHERE i.token_hash = $1
       AND LOWER(i.email) = LOWER($2)
       AND i.accepted_at IS NULL
       AND i.expires_at > ${SQL_NOW}
       AND e.user_id <> $3`,
    [hashMagicToken(token), auth.user.email, auth.user.id],
  );
  if (!invite) return invalid();

  try {
    await batch([
      // One-time token: the guard re-checks the invite inside the batch, so a parallel accept loses.
      guard(
        `EXISTS (SELECT 1 FROM event_member_invites WHERE id = $1 AND accepted_at IS NULL AND expires_at > ${SQL_NOW})`,
        [invite.id],
        "invite_used",
      ),
      {
        text: `INSERT INTO event_members (event_id, user_id, role, invited_by)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (event_id, user_id) DO UPDATE SET role = excluded.role, updated_at = ${SQL_NOW}`,
        params: [invite.event_id, auth.user.id, invite.role, invite.invited_by],
      },
      {
        text: `UPDATE event_member_invites SET accepted_at = ${SQL_NOW}, accepted_by = $1 WHERE id = $2`,
        params: [auth.user.id, invite.id],
      },
      {
        text: `INSERT INTO event_audit_log (event_id, actor_user_id, action, target_user_id, metadata)
               VALUES ($1, $2, 'member_joined', $2, $3)`,
        params: [invite.event_id, auth.user.id, { role: invite.role }],
      },
    ]);
  } catch (error) {
    if (abortCode(error) === "invite_used") return invalid();
    throw error;
  }
  return NextResponse.json({ success: true, eventId: invite.event_id });
}
