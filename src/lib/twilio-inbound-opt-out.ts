import {
  normalizeCommunicationRecipient,
  recordCommunicationSuppression,
  removeCommunicationSuppressionsForRecipient,
  type CommunicationSuppressionClient,
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

export async function processTwilioOptOutEvent(
  client: CommunicationSuppressionClient,
  event: TwilioOptOutEvent,
): Promise<TwilioOptOutResult> {
  const optOutType = normalizeTwilioOptOutType(event.optOutType);
  if (!optOutType || !event.messageSid.trim() || !event.from.trim()) {
    return { handled: false, duplicate: false, optOutType: null, ownerCount: 0 };
  }

  const receiptId = `inbound:${event.messageSid}:${optOutType}`;
  const receipt = await client.query<{ event_id: string }>(
    `INSERT INTO webhook_receipts (provider, event_id)
     VALUES ('twilio', $1)
     ON CONFLICT DO NOTHING
     RETURNING event_id`,
    [receiptId],
  );
  if (!receipt.rows[0]) {
    return { handled: true, duplicate: true, optOutType, ownerCount: 0 };
  }

  if (optOutType === "HELP") {
    return { handled: true, duplicate: false, optOutType, ownerCount: 0 };
  }

  const recipient = normalizeCommunicationRecipient("sms", event.from);
  if (optOutType === "START") {
    await removeCommunicationSuppressionsForRecipient(client, {
      channel: "sms",
      recipient,
    });
    return { handled: true, duplicate: false, optOutType, ownerCount: 0 };
  }

  const owners = await client.query<{ user_id: string; source_event_id: string }>(
    `SELECT DISTINCT ON (events.user_id)
       events.user_id, events.id AS source_event_id
     FROM guests
     JOIN events ON events.id = guests.event_id
     WHERE guests.phone = $1
     ORDER BY events.user_id, events.created_at DESC, events.id`,
    [recipient],
  );

  for (const owner of owners.rows) {
    if (optOutType === "STOP") {
      await recordCommunicationSuppression(client, {
        userId: owner.user_id,
        channel: "sms",
        recipient,
        reason: "unsubscribed",
        provider: "twilio",
        sourceEventId: owner.source_event_id,
      });
    }
  }

  return {
    handled: true,
    duplicate: false,
    optOutType,
    ownerCount: owners.rows.length,
  };
}
