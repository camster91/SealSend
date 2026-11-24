import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { batch, query } from "@/lib/db/client";
import { SQL_NOW, type Statement } from "@/lib/db/sqlite-dialect";
import { communicationSuppressionStatement, type CommunicationSuppressionReason } from "@/lib/communication-suppressions";

type Payload = {
  signature?: { timestamp?: string; token?: string; signature?: string };
  "event-data"?: {
    id?: string; event?: string; severity?: string;
    message?: { headers?: { "message-id"?: string } };
    "delivery-status"?: { message?: string };
  };
};

export async function POST(request: Request) {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) return NextResponse.json({ error: "Webhook signing key not configured" }, { status: 500 });
  const payload = await request.json() as Payload;
  const { timestamp, token, signature } = payload.signature ?? {};
  if (!timestamp || !token || !signature || Math.abs(Date.now() / 1000 - Number(timestamp)) > 15 * 60) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const expected = createHmac("sha256", signingKey).update(timestamp + token).digest("hex");
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const event = payload["event-data"];
  const eventId = event?.id;
  const messageId = event?.message?.headers?.["message-id"];
  if (!eventId || !messageId) return NextResponse.json({ received: true });
  const status = event.event === "delivered" ? "delivered"
    : event.event === "unsubscribed" || event.event === "complained" ? "opted_out"
      : event.event === "failed" && event.severity === "permanent" ? "bounced"
        : event.event === "failed" ? "failed"
          : event.event === "accepted" ? "accepted" : null;
  if (!status) return NextResponse.json({ received: true });
  const receipt = await query<{ event_id: string }>(
    "INSERT INTO webhook_receipts (provider, event_id) VALUES ('mailgun', $1) ON CONFLICT DO NOTHING RETURNING event_id", [eventId],
  );
  if (!receipt[0]) return NextResponse.json({ received: true, duplicate: true });
  try {
    const errorText = event?.["delivery-status"]?.message?.slice(0, 1000) ?? null;
    const sendLogStatus = status === "accepted" ? "sent" : status === "opted_out" ? "bounced" : status;
    const statements: Statement[] = [
      {
        text: `UPDATE announcement_deliveries SET
           status = CASE WHEN status IN ('bounced', 'opted_out') THEN status ELSE $1 END,
           error = $2,
           updated_at = ${SQL_NOW}
         WHERE trim(provider_message_id, '<>') = trim($3, '<>')`,
        params: [status, errorText, messageId],
      },
      {
        text: `UPDATE send_logs SET
           status = CASE WHEN status = 'bounced' THEN status ELSE $1 END,
           error_message = $2,
           updated_at = ${SQL_NOW}
         WHERE trim(provider_message_id, '<>') = trim($3, '<>')`,
        params: [sendLogStatus, errorText, messageId],
      },
    ];
    if (status === "opted_out" || status === "bounced") {
      const reason: CommunicationSuppressionReason = event.event === "unsubscribed"
        ? "unsubscribed"
        : event.event === "complained" ? "complained" : "bounced";
      // Rows are written at send time, long before this callback, so reading them first is safe.
      const targets = await query<{ recipient: string; owner_user_id: string; source_event_id: string }>(
        `SELECT d.recipient, events.user_id AS owner_user_id, events.id AS source_event_id
           FROM announcement_deliveries d
           JOIN event_announcements ON event_announcements.id = d.announcement_id
           JOIN events ON events.id = event_announcements.event_id
          WHERE trim(d.provider_message_id, '<>') = trim($1, '<>')
         UNION ALL
         SELECT s.recipient, events.user_id AS owner_user_id, events.id AS source_event_id
           FROM send_logs s JOIN events ON events.id = s.event_id
          WHERE trim(s.provider_message_id, '<>') = trim($1, '<>')`,
        [messageId],
      );
      const recorded = new Set<string>();
      for (const delivery of targets) {
        const key = `${delivery.owner_user_id}:${delivery.recipient.trim().toLowerCase()}`;
        if (recorded.has(key)) continue;
        recorded.add(key);
        statements.push(communicationSuppressionStatement({
          userId: delivery.owner_user_id,
          channel: "email",
          recipient: delivery.recipient,
          reason,
          provider: "mailgun",
          sourceEventId: delivery.source_event_id,
        }));
      }
    }
    await batch(statements);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Release the receipt so Mailgun can retry a transient failure.
    await query("DELETE FROM webhook_receipts WHERE provider = 'mailgun' AND event_id = $1", [eventId]);
    throw error;
  }
}
