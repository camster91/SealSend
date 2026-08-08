import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/client';

/**
 * Twilio webhook handler for SMS status callbacks
 * Handles: queued, sending, sent, failed, delivered, undelivered
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

    // Map Twilio status to our status
    const status = mapTwilioStatus(data.MessageStatus);

    if (status) {
      await updateSmsStatus(data.MessageSid, status, {
        to: data.To,
        from: data.From,
        errorCode: data.ErrorCode,
        errorMessage: getErrorMessage(data.ErrorCode),
      });
    }

    // Twilio expects a 200 OK response
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('[Twilio Webhook] Error:', error);
    // Still return 200 so Twilio doesn't retry
    return new NextResponse(null, { status: 200 });
  }
}

function mapTwilioStatus(twilioStatus: string): 'sent' | 'delivered' | 'failed' | 'bounced' | null {
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
  status: 'sent' | 'delivered' | 'failed' | 'bounced',
  metadata: {
    to: string;
    from: string;
    errorCode?: string;
    errorMessage?: string;
  }
) {
  try {
    const deliveryStatus = status === 'sent' ? 'accepted' : status;
    await query(
      `UPDATE announcement_deliveries SET status = $1, error = $2, updated_at = NOW()
       WHERE provider_message_id = $3`,
      [deliveryStatus, metadata.errorMessage || null, messageSid]
    );

    // Find the send log by provider message ID (Twilio SID)
    const sendLog = await queryOne<{ id: string; metadata: Record<string, unknown> | null }>(
      'SELECT id, metadata FROM send_logs WHERE provider_message_id = $1',
      [messageSid]
    );

    if (!sendLog) console.warn(`[Twilio Webhook] No send log found for message: ${messageSid}`);

    // Update the send log
    if (sendLog) await query(
      `UPDATE send_logs SET status = $1, error_message = $2, metadata = $3, updated_at = $4
       WHERE id = $5`,
      [
        status,
        metadata.errorMessage,
        JSON.stringify({
          ...(sendLog.metadata || {}),
          twilioStatus: status,
          errorCode: metadata.errorCode,
          to: metadata.to,
          from: metadata.from,
          updatedAt: new Date().toISOString(),
        }),
        new Date().toISOString(),
        sendLog.id,
      ]
    );

    // If failed or bounced, mark the phone as invalid
    if (status === 'failed' || status === 'bounced') {
      await markPhoneInvalid(metadata.to);
    }
  } catch (error) {
    console.error('[Twilio Webhook] Error updating SMS status:', error);
  }
}

async function markPhoneInvalid(phone: string) {
  try {
    await query(
      'UPDATE guests SET phone_invalid_at = $1, updated_at = $2 WHERE phone = $3',
      [new Date().toISOString(), new Date().toISOString(), phone]
    );
  } catch (error) {
    console.error('[Twilio Webhook] Error marking phone invalid:', error);
  }
}

// Type definitions
interface TwilioWebhookData {
  MessageSid: string;
  MessageStatus: string;
  To: string;
  From: string;
  ErrorCode?: string;
  ApiVersion: string;
  AccountSid: string;
}
