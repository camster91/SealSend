import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { rm } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getDb().connect();
  let deleted = 0;
  let blocked = 0;
  try {
    await client.query("BEGIN");
    const due = await client.query<{ user_id: string }>(
      `SELECT user_id FROM account_deletion_requests
        WHERE status = 'pending' AND scheduled_for <= NOW()
        ORDER BY scheduled_for FOR UPDATE SKIP LOCKED LIMIT 25`,
    );
    for (const { user_id: userId } of due.rows) {
      const subscription = await client.query(
        `SELECT 1 FROM user_subscriptions
          WHERE user_id = $1 AND status IN ('active', 'past_due', 'trialing') AND tier <> 'free'`,
        [userId],
      );
      if (subscription.rowCount) {
        blocked += 1;
        continue;
      }
      await client.query("INSERT INTO deleted_account_upload_cleanup (user_directory) VALUES ($1) ON CONFLICT DO NOTHING", [userId]);
      await client.query("DELETE FROM events WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM organizations WHERE is_personal AND created_by = $1", [userId]);
      await client.query("DELETE FROM user_subscriptions WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM user_sessions WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM admin_users WHERE id = $1", [userId]);
      deleted += 1;
    }
    await client.query("COMMIT");
    const cleanup = await getDb().query<{ user_directory: string }>(
      "UPDATE deleted_account_upload_cleanup SET attempt_count = attempt_count + 1 WHERE user_directory IN (SELECT user_directory FROM deleted_account_upload_cleanup ORDER BY queued_at LIMIT 25) RETURNING user_directory",
    );
    let uploadsDeleted = 0;
    for (const { user_directory: userId } of cleanup.rows) {
      try {
        await rm(path.join(process.cwd(), "uploads", userId), { recursive: true, force: true });
        await getDb().query("DELETE FROM deleted_account_upload_cleanup WHERE user_directory = $1", [userId]);
        uploadsDeleted += 1;
      } catch (error) {
        console.error("[delete-accounts] Upload cleanup will retry", error);
      }
    }
    return NextResponse.json({ examined: due.rowCount, deleted, blocked, uploadsDeleted, uploadCleanupPending: (cleanup.rowCount ?? 0) - uploadsDeleted });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[delete-accounts] Failed to process deletion requests", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export const POST = GET;
