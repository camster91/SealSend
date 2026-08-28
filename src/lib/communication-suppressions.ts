import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { query } from "@/lib/db/client";

export type CommunicationChannel = "email" | "sms";
export type CommunicationSuppressionReason = "unsubscribed" | "complained" | "bounced" | "manual";

export function normalizeCommunicationRecipient(channel: CommunicationChannel, recipient: string): string {
  if (channel === "email") return recipient.trim().toLowerCase();
  const compact = recipient.trim().replace(/[^\d+]/g, "");
  return compact.startsWith("+")
    ? `+${compact.slice(1).replace(/\+/g, "")}`
    : compact.replace(/\+/g, "");
}

export function communicationSuppressionKey(channel: CommunicationChannel, recipient: string): string {
  const normalized = normalizeCommunicationRecipient(channel, recipient);
  if (!normalized) throw new Error("Communication recipient is empty");
  return `${channel}:${createHash("sha256").update(normalized).digest("hex")}`;
}

export function isCommunicationSuppressed(
  suppressions: ReadonlySet<string>,
  channel: CommunicationChannel,
  recipient: string,
): boolean {
  return suppressions.has(communicationSuppressionKey(channel, recipient));
}

export async function getCommunicationSuppressions(userId: string): Promise<Set<string>> {
  const rows = await query<{ channel: CommunicationChannel; recipient_hash: string }>(
    `SELECT channel, recipient_hash
     FROM communication_suppressions
     WHERE user_id = $1`,
    [userId],
  );
  return new Set(rows.map((row) => `${row.channel}:${row.recipient_hash}`));
}

export async function recordCommunicationSuppression(
  client: Pick<PoolClient, "query">,
  input: {
    userId: string;
    channel: CommunicationChannel;
    recipient: string;
    reason: CommunicationSuppressionReason;
    provider: "mailgun" | "twilio" | "manual";
    sourceEventId?: string | null;
  },
): Promise<void> {
  const [, recipientHash] = communicationSuppressionKey(input.channel, input.recipient).split(":");
  await client.query(
    `INSERT INTO communication_suppressions
       (user_id, channel, recipient_hash, reason, provider, source_event_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, channel, recipient_hash) DO UPDATE SET
       reason = EXCLUDED.reason,
       provider = EXCLUDED.provider,
       source_event_id = EXCLUDED.source_event_id,
       updated_at = NOW()`,
    [input.userId, input.channel, recipientHash, input.reason, input.provider, input.sourceEventId ?? null],
  );
}
