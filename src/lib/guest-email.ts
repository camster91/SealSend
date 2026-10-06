import { getDb, queryOne } from "@/lib/db/client";
import { emailSendOptions, getEventBranding, type EventBranding } from "@/lib/brands";
import { communicationSuppressionKey, type CommunicationSuppressionClient } from "@/lib/communication-suppressions";
import type { EmailCompliance } from "@/lib/email-templates";
import { listUnsubscribeHeaders, unsubscribeUrl, type UnsubscribeTarget } from "@/lib/unsubscribe";

/**
 * Anti-spam pieces shared by every guest-facing email (invitations, both
 * reminder paths, announcements): who the host is, where replies go, and the
 * per-recipient unsubscribe link and List-Unsubscribe headers.
 */
export type GuestEmailSender = {
  /** The event owner; an unsubscribe stops emails from this host only. */
  ownerUserId: string;
  /** Carried in the unsubscribe token so the page can name the host as this email did. */
  eventId: string;
  hostName: string;
  /** The owner's account email, used for Reply-To when the brand sets none. */
  ownerEmail: string | null;
};

export const HOST_NAME_FALLBACK = "Your host";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveHostDisplayName(input: {
  brandName?: string | null;
  eventHostName?: string | null;
  accountName?: string | null;
}): string {
  return clean(input.brandName) ?? clean(input.eventHostName) ?? clean(input.accountName) ?? HOST_NAME_FALLBACK;
}

export function brandDisplayName(branding: EventBranding | null): string | null {
  return branding ? clean(branding.senderName) ?? clean(branding.name) : null;
}

/** The host name a guest email's footer shows for an event. The unsubscribe page uses the same function. */
export function footerHostName(
  branding: EventBranding | null,
  eventHostName: string | null | undefined,
  accountName: string | null | undefined,
): string {
  return resolveHostDisplayName({ brandName: brandDisplayName(branding), eventHostName, accountName });
}

async function getOwnerAccount(ownerUserId: string) {
  return queryOne<{ name: string | null; email: string | null }>(
    "SELECT name, email FROM admin_users WHERE id = $1",
    [ownerUserId],
  );
}

export async function getGuestEmailSender(
  event: { id: string; user_id: string; host_name?: string | null },
  branding: EventBranding | null,
): Promise<GuestEmailSender> {
  const owner = await getOwnerAccount(event.user_id);
  return {
    ownerUserId: event.user_id,
    eventId: event.id,
    hostName: footerHostName(branding, event.host_name, owner?.name),
    ownerEmail: clean(owner?.email),
  };
}

/**
 * The unsubscribe page's host name. While the event still belongs to the
 * owner it is exactly what that event's footer showed; if the event is gone,
 * the owner's personal default brand, then their account name.
 */
export function resolveUnsubscribeHostName(input: {
  event: { host_name: string | null } | null;
  branding: EventBranding | null;
  accountName: string | null | undefined;
  personalBrandName: string | null | undefined;
}): string {
  if (input.event) return footerHostName(input.branding, input.event.host_name, input.accountName);
  return resolveHostDisplayName({ brandName: input.personalBrandName, accountName: input.accountName });
}

export async function getUnsubscribeHostName(target: UnsubscribeTarget): Promise<string> {
  const event = await queryOne<{ host_name: string | null }>(
    "SELECT host_name FROM events WHERE id = $1 AND user_id = $2",
    [target.eventId, target.ownerUserId],
  );
  if (event) {
    const owner = await getOwnerAccount(target.ownerUserId);
    return resolveUnsubscribeHostName({ event, branding: await getEventBranding(target.eventId), accountName: owner?.name, personalBrandName: null });
  }
  const row = await queryOne<{ account_name: string | null; brand_name: string | null }>(
    `SELECT u.name AS account_name, COALESCE(NULLIF(TRIM(b.sender_name), ''), b.name) AS brand_name
       FROM admin_users u
       LEFT JOIN organizations o ON o.created_by = u.id AND o.is_personal
       LEFT JOIN brands b ON b.organization_id = o.id AND b.is_default
      WHERE u.id = $1
      LIMIT 1`,
    [target.ownerUserId],
  );
  return resolveUnsubscribeHostName({ event: null, branding: null, accountName: row?.account_name, personalBrandName: row?.brand_name });
}

/** Whether this host already has any email suppression for this address (unsubscribed, bounced, complained or manual). */
export async function hasEmailSuppression(
  ownerUserId: string,
  email: string,
  client: CommunicationSuppressionClient = getDb(),
): Promise<boolean> {
  const [, recipientHash] = communicationSuppressionKey("email", email).split(":");
  const result = await client.query<{ found: number }>(
    `SELECT 1 AS found FROM communication_suppressions
      WHERE user_id = $1 AND channel = $2 AND recipient_hash = $3
      LIMIT 1`,
    [ownerUserId, "email", recipientHash],
  );
  return result.rows.length > 0;
}

/** Footer details and List-Unsubscribe headers for one recipient. */
export function guestEmailCompliance(
  sender: GuestEmailSender,
  recipientEmail: string,
): { compliance: EmailCompliance; headers: Record<string, string> } {
  return {
    compliance: { hostName: sender.hostName, unsubscribeUrl: unsubscribeUrl(sender.ownerUserId, recipientEmail, sender.eventId) },
    headers: listUnsubscribeHeaders(sender.ownerUserId, recipientEmail, sender.eventId),
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
