import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/client";
import { hashMagicToken, isValidMagicToken } from "@/lib/magic-token";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const approveSchema = z.object({ name: z.string().trim().min(1, "Enter your name").max(120) }).strict();

/** A client approves the invitation from their review link. Public, rate-limited, one approval per link. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { success } = await rateLimit(`client-approve:${getClientIp(request)}`, { max: 10, windowSeconds: 3600 });
  if (!success) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  if (!isValidMagicToken(token)) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  const parsed = approveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter your name" }, { status: 400 });

  const [share] = await query<{ id: string; event_id: string }>(
    `UPDATE event_client_shares SET approved_at = NOW(), approver_name = $2
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW() AND approved_at IS NULL
      RETURNING id, event_id`,
    [hashMagicToken(token), parsed.data.name],
  );
  if (!share) return NextResponse.json({ error: "This link is invalid, expired, or already approved." }, { status: 404 });
  await query(
    `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata) VALUES ($1, NULL, 'client_approved', $2::jsonb)`,
    [share.event_id, JSON.stringify({ shareId: share.id, approverName: parsed.data.name })],
  );
  return NextResponse.json({ success: true });
}
