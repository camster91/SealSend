import crypto from "node:crypto";
import { batch, queryOne } from "@/lib/db/client";
import { SQL_NOW, abortCode, guard } from "@/lib/db/sqlite-dialect";
import { hashPassword } from "@/lib/password";

/** Addresses under this domain are synthetic keys for phone-only accounts; nobody may register one. */
export const RESERVED_ACCOUNT_DOMAIN = "users.sealsend.local";

export function isReservedAccountEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${RESERVED_ACCOUNT_DOMAIN}`);
}

/**
 * Call after a one-time code proves who owns the account's email or phone.
 *
 * An unverified account was made with a password by someone who never proved the
 * address was theirs. On the first proof, drop every way they could get back in:
 * the password, sessions, people they added, pending invitations, share links and
 * outbound webhooks. Events are kept, because a genuine host takes this path too.
 */
export async function claimAccountByCode(userId: string): Promise<void> {
  const account = await queryOne<{ email_verified_at: string | null }>(
    "SELECT email_verified_at FROM admin_users WHERE id = $1",
    [userId],
  );
  if (!account || account.email_verified_at) return;

  const unusablePassword = await hashPassword(crypto.randomBytes(32).toString("hex"));
  // Events the account owns directly, and workspaces it created. A workspace someone
  // else created is left alone even if this account was made an owner of it.
  const ownOrgs = "SELECT id FROM organizations WHERE created_by = $1";
  const ownEvents = `SELECT id FROM events WHERE user_id = $1 OR organization_id IN (${ownOrgs})`;
  try {
    await batch([
      guard("EXISTS (SELECT 1 FROM admin_users WHERE id = $1 AND email_verified_at IS NULL)", [userId], "already_verified"),
      { text: "DELETE FROM user_sessions WHERE user_id = $1 AND user_role = 'admin'", params: [userId] },
      { text: `DELETE FROM event_members WHERE event_id IN (${ownEvents}) AND user_id <> $1`, params: [userId] },
      { text: `DELETE FROM event_member_invites WHERE event_id IN (${ownEvents}) AND accepted_at IS NULL`, params: [userId] },
      { text: `UPDATE event_client_shares SET revoked_at = ${SQL_NOW} WHERE event_id IN (${ownEvents}) AND revoked_at IS NULL`, params: [userId] },
      { text: `UPDATE organization_webhooks SET active = 0 WHERE organization_id IN (${ownOrgs})`, params: [userId] },
      { text: `DELETE FROM organization_invites WHERE organization_id IN (${ownOrgs}) AND accepted_at IS NULL`, params: [userId] },
      { text: `DELETE FROM organization_members WHERE organization_id IN (${ownOrgs}) AND user_id <> $1`, params: [userId] },
      {
        text: `UPDATE admin_users SET password = $2, email_verified_at = ${SQL_NOW}, updated_at = ${SQL_NOW} WHERE id = $1`,
        params: [userId, unusablePassword],
      },
    ]);
  } catch (error) {
    if (abortCode(error) !== "already_verified") throw error;
  }
}
