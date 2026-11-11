import { createHash } from "node:crypto";
import { query } from "@/lib/db/client";
import { SQL_NOW, type Statement } from "@/lib/db/sqlite-dialect";

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

export type CommunicationSuppressionInput = {
  userId: string;
  channel: CommunicationChannel;
  recipient: string;
  reason: CommunicationSuppressionReason;
  provider: "mailgun" | "twilio" | "manual";
  sourceEventId?: string | null;
  /** Leave an existing row (e.g. a bounce or complaint) untouched instead of overwriting its reason. */
  keepExisting?: boolean;
};

export type CommunicationSuppressionRemoval = {
  channel: CommunicationChannel;
  recipient: string;
};

/** The suppression upsert as a statement, so callers can put it inside their own batch. */
export function communicationSuppressionStatement(input: CommunicationSuppressionInput): Statement {
  const [, recipientHash] = communicationSuppressionKey(input.channel, input.recipient).split(":");
  const onConflict = input.keepExisting
    ? "ON CONFLICT (user_id, channel, recipient_hash) DO NOTHING"
    : `ON CONFLICT (user_id, channel, recipient_hash) DO UPDATE SET
       reason = EXCLUDED.reason,
       provider = EXCLUDED.provider,
       source_event_id = EXCLUDED.source_event_id,
       updated_at = ${SQL_NOW}`;
  return {
    text: `INSERT INTO communication_suppressions
       (user_id, channel, recipient_hash, reason, provider, source_event_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ${onConflict}`,
    params: [input.userId, input.channel, recipientHash, input.reason, input.provider, input.sourceEventId ?? null],
  };
}

/** Deletes every host's suppression of this recipient, as a statement for the caller's batch. */
export function removeCommunicationSuppressionsStatement(input: CommunicationSuppressionRemoval): Statement {
  const [, recipientHash] = communicationSuppressionKey(input.channel, input.recipient).split(":");
  return {
    text: `DELETE FROM communication_suppressions
     WHERE channel = $1 AND recipient_hash = $2`,
    params: [input.channel, recipientHash],
  };
}

export async function recordCommunicationSuppression(input: CommunicationSuppressionInput): Promise<void> {
  const { text, params } = communicationSuppressionStatement(input);
  await query(text, params);
}

export async function removeCommunicationSuppressionsForRecipient(input: CommunicationSuppressionRemoval): Promise<void> {
  const { text, params } = removeCommunicationSuppressionsStatement(input);
  await query(text, params);
}

/** SQLite (node:sqlite and D1) reports a foreign key failure in the message; there is no SQLSTATE code. */
export function isForeignKeyViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /FOREIGN KEY constraint failed/i.test(message);
}
