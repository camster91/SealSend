import { NextRequest, NextResponse } from "next/server";
import { abortCode, guard, SQL_NOW, type Statement } from "@/lib/db/sqlite-dialect";
import { batch, query } from "@/lib/db/client";
import { getBlobStore } from "@/lib/blob-store";

const BLOCKING_SUBSCRIPTION_SQL = `EXISTS (SELECT 1 FROM user_subscriptions
  WHERE user_id = $1 AND status IN ('active', 'past_due', 'trialing') AND tier <> 'free')`;

// Team workspaces the user owns with no other owner.
const SOLE_OWNED_SQL = `SELECT m.organization_id FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id AND o.is_personal = 0
   WHERE m.user_id = $1 AND m.role = 'owner'
     AND NOT EXISTS (SELECT 1 FROM organization_members other
                      WHERE other.organization_id = m.organization_id AND other.role = 'owner' AND other.user_id <> $1)`;

/**
 * Before a host's rows are deleted, keep their team workspaces working:
 * 1. Team workspaces they solely own pass ownership to the longest-serving
 *    admin, else planner. Workspaces with nobody left are removed, and other
 *    hosts' events in them move to those hosts' personal workspaces.
 * 2. Team-workspace events they created are reassigned to another owner of
 *    that workspace instead of being deleted.
 * The handover is planned from reads, then applied in one batch whose guards
 * abort it if ownership changed in between (the account is retried next run).
 */
async function deletionStatements(userId: string): Promise<Statement[]> {
  const soleOwned = (await query<{ organization_id: string }>(SOLE_OWNED_SQL, [userId])).map((row) => row.organization_id);
  const successors = soleOwned.length
    ? await query<{ organization_id: string; user_id: string }>(
      `SELECT organization_id, user_id FROM (
         SELECT m.organization_id, m.user_id, ROW_NUMBER() OVER (
                  PARTITION BY m.organization_id
                  ORDER BY CASE m.role WHEN 'admin' THEN 0 ELSE 1 END, m.created_at) AS position
           FROM organization_members m
          WHERE m.organization_id IN (SELECT value FROM json_each($1))
            AND m.user_id <> $2 AND m.role IN ('admin', 'planner'))
        WHERE position = 1`,
      [soleOwned, userId],
    )
    : [];
  const orphaned = soleOwned.filter((id) => !successors.some((successor) => successor.organization_id === id));

  return [
    guard(`EXISTS (SELECT 1 FROM account_deletion_requests
             WHERE user_id = $1 AND status = 'pending' AND scheduled_for <= ${SQL_NOW})`, [userId], "not_due"),
    guard(`NOT ${BLOCKING_SUBSCRIPTION_SQL}`, [userId], "blocked"),
    // The planned handover must still match: the same sole-owned workspaces, and each successor still eligible.
    guard(`(SELECT json_group_array(organization_id) FROM (${SOLE_OWNED_SQL} ORDER BY m.organization_id)) = $2`,
      [userId, [...soleOwned].sort()], "ownership_changed"),
    ...successors.map((successor) => guard(
      `EXISTS (SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND role IN ('admin', 'planner'))`,
      [successor.organization_id, successor.user_id], "ownership_changed")),
    ...orphaned.map((organizationId) => guard(
      `NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id <> $2 AND role IN ('admin', 'planner'))`,
      [organizationId, userId], "ownership_changed")),
    { text: "INSERT INTO deleted_account_upload_cleanup (user_directory) VALUES ($1) ON CONFLICT DO NOTHING", params: [userId] },
    {
      text: "UPDATE organization_members SET role = 'owner' WHERE organization_id || ':' || user_id IN (SELECT value FROM json_each($1))",
      params: [successors.map((successor) => `${successor.organization_id}:${successor.user_id}`)],
    },
    // Other hosts' events in orphaned workspaces move to their personal workspaces (created on first use).
    {
      text: `INSERT OR IGNORE INTO organizations (name, slug, is_personal, created_by)
             SELECT COALESCE(NULLIF(TRIM(u.name), ''), 'My events'), 'personal-' || REPLACE(u.id, '-', ''), 1, u.id
               FROM admin_users u
              WHERE u.id IN (SELECT user_id FROM events WHERE organization_id IN (SELECT value FROM json_each($1)) AND user_id <> $2)`,
      params: [orphaned, userId],
    },
    {
      text: `INSERT OR IGNORE INTO organization_members (organization_id, user_id, role)
             SELECT o.id, o.created_by, 'owner' FROM organizations o
              WHERE o.is_personal = 1
                AND o.created_by IN (SELECT user_id FROM events WHERE organization_id IN (SELECT value FROM json_each($1)) AND user_id <> $2)`,
      params: [orphaned, userId],
    },
    {
      text: `UPDATE events SET organization_id = (SELECT o.id FROM organizations o WHERE o.created_by = events.user_id AND o.is_personal = 1)
              WHERE organization_id IN (SELECT value FROM json_each($1)) AND user_id <> $2`,
      params: [orphaned, userId],
    },
    { text: "DELETE FROM organizations WHERE id IN (SELECT value FROM json_each($1))", params: [orphaned] },
    // Successors are owners by now, so the earliest remaining owner takes the user's team events.
    {
      text: `UPDATE events SET user_id = (
               SELECT m.user_id FROM organization_members m WHERE m.organization_id = events.organization_id
                  AND m.role = 'owner' AND m.user_id <> $1 ORDER BY m.created_at LIMIT 1)
              WHERE user_id = $1
                AND organization_id IN (SELECT id FROM organizations WHERE is_personal = 0)
                AND EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = events.organization_id
                               AND m.role = 'owner' AND m.user_id <> $1)`,
      params: [userId],
    },
    { text: "DELETE FROM events WHERE user_id = $1", params: [userId] },
    { text: "DELETE FROM organizations WHERE is_personal = 1 AND created_by = $1", params: [userId] },
    { text: "DELETE FROM user_subscriptions WHERE user_id = $1", params: [userId] },
    { text: "DELETE FROM user_sessions WHERE user_id = $1", params: [userId] },
    { text: "DELETE FROM admin_users WHERE id = $1", params: [userId] },
  ];
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let deleted = 0;
  let blocked = 0;
  try {
    const due = await query<{ user_id: string }>(
      `SELECT user_id FROM account_deletion_requests
        WHERE status = 'pending' AND scheduled_for <= ${SQL_NOW}
        ORDER BY scheduled_for LIMIT 25`,
    );
    // One batch per account: guards re-check due, billing and ownership when it runs, so overlapping runs can't double-delete.
    for (const { user_id: userId } of due) {
      if (await query(`SELECT 1 WHERE ${BLOCKING_SUBSCRIPTION_SQL}`, [userId]).then((rows) => rows.length > 0)) {
        blocked += 1;
        continue;
      }
      try {
        await batch(await deletionStatements(userId));
        deleted += 1;
      } catch (error) {
        const code = abortCode(error);
        if (code === "blocked") blocked += 1;
        else if (code !== "not_due" && code !== "ownership_changed") throw error;
      }
    }
    const cleanup = await query<{ user_directory: string }>(
      "UPDATE deleted_account_upload_cleanup SET attempt_count = attempt_count + 1 WHERE user_directory IN (SELECT user_directory FROM deleted_account_upload_cleanup ORDER BY queued_at LIMIT 25) RETURNING user_directory",
    );
    let uploadsDeleted = 0;
    for (const { user_directory: userId } of cleanup) {
      try {
        await getBlobStore().deletePrefix(userId);
        await query("DELETE FROM deleted_account_upload_cleanup WHERE user_directory = $1", [userId]);
        uploadsDeleted += 1;
      } catch (error) {
        console.error("[delete-accounts] Upload cleanup will retry", error);
      }
    }
    return NextResponse.json({ examined: due.length, deleted, blocked, uploadsDeleted, uploadCleanupPending: cleanup.length - uploadsDeleted });
  } catch (error) {
    console.error("[delete-accounts] Failed to process deletion requests", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = GET;
