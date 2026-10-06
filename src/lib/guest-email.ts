import { queryOne } from "@/lib/db/client";
import { emailSendOptions, type EventBranding } from "@/lib/brands";
import type { EmailCompliance } from "@/lib/email-templates";
import { listUnsubscribeHeaders, unsubscribeUrl } from "@/lib/unsubscribe";

/**
 * Anti-spam pieces shared by every guest-facing email (invitations, both
 * reminder paths, announcements): who the host is, where replies go, and the
 * per-recipient unsubscribe link and List-Unsubscribe headers.
 */
export type GuestEmailSender = {
  /** The event owner; an unsubscribe stops emails from this host only. */
  ownerUserId: string;
  hostName: string;
  /** The owner's account email, used for Reply-To when the brand sets none. */
  ownerEmail: string | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveHostDisplayName(input: {
  brandName?: string | null;
  eventHostName?: string | null;
  accountName?: string | null;
}): string {
  return clean(input.brandName) ?? clean(input.eventHostName) ?? clean(input.accountName) ?? "Your host";
}

export function brandDisplayName(branding: EventBranding | null): string | null {
  return branding ? clean(branding.senderName) ?? clean(branding.name) : null;
}

export async function getGuestEmailSender(
  event: { user_id: string; host_name?: string | null },
  branding: EventBranding | null,
): Promise<GuestEmailSender> {
  const owner = await queryOne<{ name: string | null; email: string | null }>(
    "SELECT name, email FROM admin_users WHERE id = $1",
    [event.user_id],
  );
  return {
    ownerUserId: event.user_id,
    hostName: resolveHostDisplayName({
      brandName: brandDisplayName(branding),
      eventHostName: event.host_name,
      accountName: owner?.name,
    }),
    ownerEmail: clean(owner?.email),
  };
}

/**
 * The host name shown on the unsubscribe page. The token names only the
 * owner, so this uses the owner's personal default brand, then their account
 * name; null when neither is set.
 */
export async function getUnsubscribeHostName(ownerUserId: string): Promise<string | null> {
  const row = await queryOne<{ account_name: string | null; brand_name: string | null }>(
    `SELECT u.name AS account_name, COALESCE(NULLIF(TRIM(b.sender_name), ''), b.name) AS brand_name
       FROM admin_users u
       LEFT JOIN organizations o ON o.created_by = u.id AND o.is_personal
       LEFT JOIN brands b ON b.organization_id = o.id AND b.is_default
      WHERE u.id = $1
      LIMIT 1`,
    [ownerUserId],
  );
  return clean(row?.brand_name) ?? clean(row?.account_name);
}

/** Footer details and List-Unsubscribe headers for one recipient. */
export function guestEmailCompliance(
  sender: GuestEmailSender,
  recipientEmail: string,
): { compliance: EmailCompliance; headers: Record<string, string> } {
  return {
    compliance: { hostName: sender.hostName, unsubscribeUrl: unsubscribeUrl(sender.ownerUserId, recipientEmail) },
    headers: listUnsubscribeHeaders(sender.ownerUserId, recipientEmail),
  };
}

/**
 * From/Reply-To for guest emails. From stays SealSend's verified sender (with
 * the brand display name); replies go to the brand's reply-to address, or
 * failing that, to the host's own account email.
 */
export function guestEmailSendOptions(
  branding: EventBranding | null,
  sender: GuestEmailSender,
): { from?: string; replyTo?: string } {
  const options = emailSendOptions(branding);
  const replyTo = options.replyTo ?? sender.ownerEmail;
  return replyTo ? { ...options, replyTo } : options;
}
