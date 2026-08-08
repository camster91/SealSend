import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

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
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const receipt = await client.query(
      "INSERT INTO webhook_receipts (provider, event_id) VALUES ('mailgun', $1) ON CONFLICT DO NOTHING RETURNING event_id", [eventId],
    );
    if (!receipt.rows[0]) { await client.query("ROLLBACK"); return NextResponse.json({ received: true, duplicate: true }); }
    await client.query(
      `UPDATE announcement_deliveries SET status = $1, error = $2, updated_at = NOW()
       WHERE TRIM(BOTH '<>' FROM provider_message_id) = TRIM(BOTH '<>' FROM $3)`,
      [status, event?.["delivery-status"]?.message?.slice(0, 1000) ?? null, messageId],
    );
    const sendLogStatus = status === "accepted" ? "sent" : status === "opted_out" ? "bounced" : status;
    await client.query(
      `UPDATE send_logs SET status = $1, error_message = $2, updated_at = NOW()
       WHERE TRIM(BOTH '<>' FROM provider_message_id) = TRIM(BOTH '<>' FROM $3)`,
      [sendLogStatus, event?.["delivery-status"]?.message?.slice(0, 1000) ?? null, messageId],
    );
    await client.query("COMMIT");
    return NextResponse.json({ received: true });
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
