import { NextResponse } from "next/server";

import { requireApiHost } from "@/lib/auth/api-auth";
import { getDb } from "@/lib/db/client";
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

  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const inviteResult = await client.query<{
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
         AND i.expires_at > NOW()
         AND e.user_id <> $3
       FOR UPDATE`,
      [hashMagicToken(token), auth.user.email, auth.user.id],
    );
    const invite = inviteResult.rows[0];
    if (!invite) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Invitation is invalid, expired, or belongs to another account." }, { status: 404 });
    }

    await client.query(
      `INSERT INTO event_members (event_id, user_id, role, invited_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
      [invite.event_id, auth.user.id, invite.role, invite.invited_by],
    );
    await client.query(
      "UPDATE event_member_invites SET accepted_at = NOW(), accepted_by = $1 WHERE id = $2",
      [auth.user.id, invite.id],
    );
    await client.query(
      `INSERT INTO event_audit_log (event_id, actor_user_id, action, target_user_id, metadata)
       VALUES ($1, $2, 'member_joined', $2, $3::jsonb)`,
      [invite.event_id, auth.user.id, JSON.stringify({ role: invite.role })],
    );
    await client.query("COMMIT");
    return NextResponse.json({ success: true, eventId: invite.event_id });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
