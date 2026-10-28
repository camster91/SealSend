import { batch, query } from "@/lib/db/client";
import { abortCode, guard, type Statement } from "@/lib/db/sqlite-dialect";
import {
  communicationSuppressionStatement,
  normalizeCommunicationRecipient,
  removeCommunicationSuppressionsStatement,
} from "@/lib/communication-suppressions";

export type TwilioOptOutType = "STOP" | "START" | "HELP";

export function normalizeTwilioOptOutType(value: string | undefined): TwilioOptOutType | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === "STOP" || normalized === "START" || normalized === "HELP"
    ? normalized
    : null;
}

type TwilioOptOutEvent = {
  messageSid: string;
  from: string;
  optOutType?: string;
};

type TwilioOptOutResult = {
  handled: boolean;
  duplicate: boolean;
  optOutType: TwilioOptOutType | null;
  ownerCount: number;
};

/** The database calls this module makes; tests pass an in-memory database (openTestDb). */
export type TwilioOptOutDb = {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
  batch<T = unknown>(statements: Statement[]): Promise<T[][]>;
};

const defaultDb: TwilioOptOutDb = { query, batch };

/**
 * Applies a Twilio STOP/START/HELP. The receipt and the suppression changes are written in one
 * batch, so a failure leaves no receipt behind and Twilio's retry is processed again; the guard
 * makes a replayed message a no-op even when two deliveries of it race.
 */
export async function processTwilioOptOutEvent(
  event: TwilioOptOutEvent,
  db: TwilioOptOutDb = defaultDb,
): Promise<TwilioOptOutResult> {
  const optOutType = normalizeTwilioOptOutType(event.optOutType);
  if (!optOutType || !event.messageSid.trim() || !event.from.trim()) {
    return { handled: false, duplicate: false, optOutType: null, ownerCount: 0 };
  }

  const receiptId = `inbound:${event.messageSid}:${optOutType}`;
  const recipient = normalizeCommunicationRecipient("sms", event.from);
  const changes: Statement[] = [];
  let ownerCount = 0;

  if (optOutType === "START") {
    changes.push(removeCommunicationSuppressionsStatement({ channel: "sms", recipient }));
  } else if (optOutType === "STOP") {
    // Every organizer with this number on a guest list, credited to their newest event.
    const owners = await db.query<{ user_id: string; source_event_id: string }>(
      `SELECT user_id, source_event_id FROM (
         SELECT events.user_id, events.id AS source_event_id,
                ROW_NUMBER() OVER (PARTITION BY events.user_id ORDER BY events.created_at DESC, events.id) AS owner_rank
         FROM guests
         JOIN events ON events.id = guests.event_id
         WHERE guests.phone = $1
       ) ranked
       WHERE owner_rank = 1
       ORDER BY user_id`,
      [recipient],
    );
    ownerCount = owners.length;
    for (const owner of owners) {
      changes.push(communicationSuppressionStatement({
        userId: owner.user_id,
        channel: "sms",
        recipient,
        reason: "unsubscribed",
        provider: "twilio",
        sourceEventId: owner.source_event_id,
      }));
    }
  }

  try {
    await db.batch([
      guard(
        "NOT EXISTS (SELECT 1 FROM webhook_receipts WHERE provider = 'twilio' AND event_id = $1)",
        [receiptId],
        "duplicate_receipt",
      ),
      { text: "INSERT INTO webhook_receipts (provider, event_id) VALUES ('twilio', $1)", params: [receiptId] },
      ...changes,
    ]);
  } catch (error) {
    if (abortCode(error) === "duplicate_receipt") {
      return { handled: true, duplicate: true, optOutType, ownerCount: 0 };
    }
    throw error;
  }

  return { handled: true, duplicate: false, optOutType, ownerCount };
}
