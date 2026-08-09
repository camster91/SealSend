import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { queryOne } from "@/lib/db/client";

type DeletionRequest = { status: "pending" | "cancelled" | "completed"; requested_at: string; scheduled_for: string };

export async function GET() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const request = await queryOne<DeletionRequest>(
    "SELECT status, requested_at, scheduled_for FROM account_deletion_requests WHERE user_id = $1",
    [auth.user.id],
  );
  return NextResponse.json({ request }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const activeSubscription = await queryOne(
    `SELECT id FROM user_subscriptions
      WHERE user_id = $1 AND status IN ('active', 'past_due', 'trialing') AND tier <> 'free'`,
    [auth.user.id],
  );
  if (activeSubscription) {
    return NextResponse.json({ error: "Cancel the active subscription before scheduling account deletion." }, { status: 409 });
  }
  const request = await queryOne<DeletionRequest>(
    `INSERT INTO account_deletion_requests (user_id, status, requested_at, scheduled_for, cancelled_at, completed_at)
     VALUES ($1, 'pending', NOW(), NOW() + INTERVAL '7 days', NULL, NULL)
     ON CONFLICT (user_id) DO UPDATE SET status = 'pending', requested_at = NOW(),
       scheduled_for = NOW() + INTERVAL '7 days', cancelled_at = NULL, completed_at = NULL
     RETURNING status, requested_at, scheduled_for`,
    [auth.user.id],
  );
  return NextResponse.json({ request }, { status: 202, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const request = await queryOne<DeletionRequest>(
    `UPDATE account_deletion_requests SET status = 'cancelled', cancelled_at = NOW()
      WHERE user_id = $1 AND status = 'pending'
      RETURNING status, requested_at, scheduled_for`,
    [auth.user.id],
  );
  if (!request) return NextResponse.json({ error: "No pending deletion request" }, { status: 404 });
  return NextResponse.json({ request }, { headers: { "Cache-Control": "no-store" } });
}
