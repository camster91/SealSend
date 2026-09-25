import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { generateMagicToken, hashMagicToken, previewMagicToken } from "@/lib/magic-token";
import { CLIENT_SHARE_LIFETIME_DAYS } from "@/lib/clients";
import { rateLimit } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ eventId: string }> };

/** Creates a read-only client review link. The raw token is only returned once. */
export async function POST(_request: Request, { params }: RouteParams) {
  const { eventId } = await params;
  const auth = await requireEventPermission(eventId, "edit_event");
  if (auth.error) return auth.error;
  const { success } = await rateLimit(`client-share:${auth.user.id}`, { max: 20, windowSeconds: 3600 });
  if (!success) return NextResponse.json({ error: "Too many links. Please try again later." }, { status: 429 });

  const token = generateMagicToken();
  const expiresAt = new Date(Date.now() + CLIENT_SHARE_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO event_client_shares (event_id, token_hash, token_preview, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [eventId, hashMagicToken(token), previewMagicToken(token), auth.user.id, expiresAt.toISOString()],
  );
  await query(
    `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata) VALUES ($1, $2, 'client_link_created', '{}'::jsonb)`,
    [eventId, auth.user.id],
  );
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app").replace(/\/$/, "");
  return NextResponse.json({ url: `${siteUrl}/client/${token}`, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
