import { NextRequest, NextResponse } from 'next/server';
import { batch, query } from '@/lib/db/client';
import { SQL_NOW, type Statement } from '@/lib/db/sqlite-dialect';
import { processTwilioOptOutEvent } from '@/lib/twilio-inbound-opt-out';

/**
 * Twilio webhook handler for SMS status callbacks and incoming opt-out events.
 * Handles: queued, sending, sent, failed, delivered, undelivered, STOP, START, HELP.
 *
 * Configure in Twilio Console > Phone Numbers > Manage > Active Numbers
 * Set "Messaging" > "Webhook" for status callbacks:
 * URL: https://yourdomain.com/api/webhooks/twilio
 * HTTP POST
 *
 * Or set on individual messages via statusCallback parameter
 */

export async function POST(request: NextRequest) {
  try {
    // Twilio sends form-encoded data, not JSON
    const formData = await request.formData();
    const data = Object.fromEntries(formData.entries()) as unknown as TwilioWebhookData;

    // Verify the request is from Twilio using signature validation (fail closed)
    const twilioSignature = request.headers.get('x-twilio-signature');
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      console.error('[Twilio Webhook] TWILIO_AUTH_TOKEN is not configured');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!twilioSignature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const { createHmac, timingSafeEqual } = await import('crypto');
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL || request.url;

    // Sort form params alphabetically and concatenate
    const sortedParams = Object.keys(data).sort().reduce((acc, key) => {
      return acc + key + (data as unknown as Record<string, string>)[key];
    }, '');

    const expectedSignature = createHmac('sha1', authToken)
      .update(webhookUrl + sortedParams)
      .digest('base64');

    const sigBuffer = Buffer.from(twilioSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.error('[Twilio Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    if (data.OptOutType && data.MessageSid && data.From) {
      // The receipt and the suppression changes are written in one batch inside processTwilioOptOutEvent.
      const result = await processTwilioOptOutEvent({
        messageSid: data.MessageSid,
        from: data.From,
        optOutType: data.OptOutType,
      });

      if (result.duplicate) {
        return NextResponse.json({ received: true, duplicate: true });
      }

      // Advanced Opt-Out has already sent Twilio's configured reply. Return empty TwiML.
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      });
    }

    // Map Twilio status to our status
    const status = mapTwilioStatus(data.MessageStatus);

    if (status && data.MessageSid && data.MessageStatus && data.To) {
      const processed = await updateSmsStatus(data.MessageSid, data.MessageStatus, status, {
        to: data.To,
        from: data.From,
        errorCode: data.ErrorCode,
        errorMessage: getErrorMessage(data.ErrorCode),
      });
      if (!processed) return NextResponse.json({ received: true, duplicate: true });
    }

    // Twilio expects a 200 OK response
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('[Twilio Webhook] Error:', error);
    // Fail transient processing errors so Twilio retries instead of silently losing delivery state.
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

function mapTwilioStatus(twilioStatus?: string): 'sent' | 'delivered' | 'failed' | 'bounced' | null {
  if (!twilioStatus) return null;
  const statusMap: Record<string, 'sent' | 'delivered' | 'failed' | 'bounced'> = {
    'sent': 'sent',
    'delivered': 'delivered',
    'failed': 'failed',
    'undelivered': 'bounced',
  };

  return statusMap[twilioStatus] || null;
}

function getErrorMessage(errorCode?: string): string | undefined {
  if (!errorCode) return undefined;

  // Common Twilio error codes
  const errorMessages: Record<string, string> = {
    '30001': 'Queue overflow',
    '30002': 'Account suspended',
    '30003': 'Unreachable destination handset',
    '30004': 'Message blocked',
    '30005': 'Unknown destination handset',
    '30006': 'Landline or unreachable carrier',
    '30007': 'Carrier violation',
    '30008': 'Unknown error',
    '30009': 'Missing segment',
    '30010': 'Message price exceeds max price',
    '30011': 'Invalid sender ID',
    '30012': 'Invalid messaging service SID',
    '30013': 'Invalid body',
    '30014': 'Invalid To number',
    '30015': 'Invalid From number',
    '30016': 'Invalid body encoding',
    '30017': 'Media URL is invalid',
    '30018': 'Message body too large',
    '30019': 'Invalid status callback URL',
    '30020': 'Invalid messaging feature',
    '30021': 'Invalid priority',
    '30022': 'Invalid application SID',
    '30023': 'Invalid callback URL',
    '30024': 'Invalid fallback URL',
    '30025': 'Invalid status callback method',
    '30026': 'Invalid fallback method',
    '30027': 'Invalid method',
    '30028': 'Invalid validity period',
    '30029': 'Invalid force delivery',
    '30030': 'Invalid smart encoded',
    '30031': 'Invalid persistent action',
    '30032': 'Invalid max price',
    '30033': 'Invalid provide feedback',
    '30034': 'Invalid attempt',
    '30035': 'Invalid validity period',
    '30036': 'Invalid force opt in',
  };

  return errorMessages[errorCode] || `Error code: ${errorCode}`;
}

async function updateSmsStatus(
  messageSid: string,
  providerStatus: string,
  status: 'sent' | 'delivered' | 'failed' | 'bounced',
  metadata: {
    to: string;
    from: string;
    errorCode?: string;
    errorMessage?: string;
  }
) {
  const receiptId = `${messageSid}:${providerStatus}`;
  const receipt = await query<{ event_id: string }>(
    `INSERT INTO webhook_receipts (provider, event_id)
     VALUES ('twilio', $1)
     ON CONFLICT DO NOTHING
     RETURNING event_id`,
    [receiptId]
  );
  if (!receipt[0]) return false;

  try {
    const deliveryStatus = status === 'sent' ? 'accepted' : status;
    const statements: Statement[] = [
      {
        text: `UPDATE announcement_deliveries SET
           status = CASE
             WHEN status IN ('delivered', 'bounced', 'opted_out') THEN status
             ELSE $1
           END,
           error = $2,
           updated_at = ${SQL_NOW}
         WHERE provider_message_id = $3`,
        params: [deliveryStatus, metadata.errorMessage || null, messageSid],
      },
      {
        // json_patch merges into the stored metadata in the same statement (no read-modify-write race).
        text: `UPDATE send_logs SET
           status = CASE WHEN status IN ('delivered', 'bounced') THEN status ELSE $1 END,
           error_message = $2,
           metadata = json_patch(COALESCE(metadata, '{}'), $3),
           updated_at = $4
         WHERE provider_message_id = $5
         RETURNING id`,
        params: [
          status,
          metadata.errorMessage ?? null,
          {
            twilioStatus: status,
            errorCode: metadata.errorCode,
            to: metadata.to,
            from: metadata.from,
            updatedAt: new Date().toISOString(),
          },
          new Date(),
          messageSid,
        ],
      },
    ];
    if (status === 'failed' || status === 'bounced') {
      statements.push({
        text: 'UPDATE guests SET phone_invalid_at = $1, updated_at = $2 WHERE phone = $3',
        params: [new Date(), new Date(), metadata.to],
      });
    }
    const [, sendLogs] = await batch(statements);
    if (!sendLogs.length) console.warn(`[Twilio Webhook] No send log found for message: ${messageSid}`);
    return true;
  } catch (error) {
    // Release the receipt so Twilio can retry a transient failure.
    await query("DELETE FROM webhook_receipts WHERE provider = 'twilio' AND event_id = $1", [receiptId]);
    throw error;
  }
}

// Type definitions
interface TwilioWebhookData {
  MessageSid: string;
  MessageStatus?: string;
  To?: string;
  From: string;
  OptOutType?: string;
  ErrorCode?: string;
  ApiVersion?: string;
  AccountSid?: string;
}
