import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { rm } from "fs/promises";
import path from "path";

/**
 * Before a host's rows are deleted, keep their team workspaces working:
 * 1. Team workspaces they solely own pass ownership to the longest-serving
 *    admin, else planner. Workspaces with nobody left are removed, and other
 *    hosts' events in them move to those hosts' personal workspaces.
 * 2. Team-workspace events they created are reassigned to another owner of
 *    that workspace instead of being deleted.
 */
const TEAM_WORKSPACE_HANDOVER_SQL = `
  WITH sole_owned AS (
    SELECT m.organization_id FROM organization_members m
      JOIN organizations o ON o.id = m.organization_id AND NOT o.is_personal
     WHERE m.user_id = $1 AND m.role = 'owner'
       AND NOT EXISTS (SELECT 1 FROM organization_members other
                        WHERE other.organization_id = m.organization_id AND other.role = 'owner' AND other.user_id <> $1)
  ), successors AS (
    SELECT DISTINCT ON (m.organization_id) m.organization_id, m.user_id
      FROM organization_members m JOIN sole_owned s ON s.organization_id = m.organization_id
     WHERE m.user_id <> $1 AND m.role IN ('admin', 'planner')
     ORDER BY m.organization_id, CASE m.role WHEN 'admin' THEN 0 ELSE 1 END, m.created_at
  ), promoted AS (
    UPDATE organization_members m SET role = 'owner'
      FROM successors s WHERE m.organization_id = s.organization_id AND m.user_id = s.user_id
    RETURNING m.organization_id
  ), orphaned AS (
    SELECT organization_id FROM sole_owned WHERE organization_id NOT IN (SELECT organization_id FROM successors)
  ), rehomed AS (
    UPDATE events e SET organization_id = sealsend_personal_organization(e.user_id)
     WHERE e.organization_id IN (SELECT organization_id FROM orphaned) AND e.user_id <> $1
    RETURNING e.id
  ), removed AS (
    DELETE FROM organizations WHERE id IN (SELECT organization_id FROM orphaned)
    RETURNING id
  )
  UPDATE events e SET user_id = (
      SELECT COALESCE(
        (SELECT m.user_id FROM organization_members m WHERE m.organization_id = e.organization_id
          AND m.role = 'owner' AND m.user_id <> $1 ORDER BY m.created_at LIMIT 1),
        (SELECT s.user_id FROM successors s WHERE s.organization_id = e.organization_id)))
   WHERE e.user_id = $1
     AND e.organization_id IN (SELECT id FROM organizations WHERE NOT is_personal)
     AND e.organization_id NOT IN (SELECT organization_id FROM orphaned)
     AND COALESCE(
        (SELECT m.user_id FROM organization_members m WHERE m.organization_id = e.organization_id
          AND m.role = 'owner' AND m.user_id <> $1 LIMIT 1),
        (SELECT s.user_id FROM successors s WHERE s.organization_id = e.organization_id)) IS NOT NULL`;

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
      await client.query(TEAM_WORKSPACE_HANDOVER_SQL, [userId]);
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
