/**
 * Minimal Twilio client for sending SMS. It calls the Messages REST API with
 * fetch, so it runs on Node and on Cloudflare Workers (the twilio SDK does not).
 */

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface TwilioCredentials {
  accountSid: string;
  /** API key SID (or the account SID when authenticating with the auth token). */
  username: string;
  /** API key secret (or the auth token). */
  password: string;
}

export interface TwilioMessageParams {
  to: string;
  body: string;
  messagingServiceSid?: string;
  from?: string;
  statusCallback?: string;
}

export interface TwilioMessage {
  sid: string;
  status: string;
  numSegments: number | null;
}

export interface TwilioClient {
  messages: { create(params: TwilioMessageParams): Promise<TwilioMessage> };
}

export function createTwilioClient(credentials: TwilioCredentials, fetchImpl: FetchLike = fetch): TwilioClient {
  const authorization = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
  return {
    messages: {
      async create(params) {
        const form = new URLSearchParams({ To: params.to, Body: params.body });
        if (params.messagingServiceSid) form.set("MessagingServiceSid", params.messagingServiceSid);
        if (params.from) form.set("From", params.from);
        if (params.statusCallback) form.set("StatusCallback", params.statusCallback);
        const response = await fetchImpl(`${TWILIO_API_BASE}/Accounts/${encodeURIComponent(credentials.accountSid)}/Messages.json`, {
          method: "POST",
          headers: { Authorization: authorization, "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        });
        const payload = (await response.json().catch(() => ({}))) as { sid?: string; status?: string; num_segments?: string; message?: string; code?: number };
        if (!response.ok || !payload.sid) {
          throw Object.assign(new Error(payload.message || `Twilio request failed with HTTP ${response.status}`), { status: response.status, code: payload.code });
        }
        return {
          sid: payload.sid,
          status: payload.status ?? "queued",
          numSegments: payload.num_segments ? Number(payload.num_segments) : null,
        };
      },
    },
  };
}

let client: TwilioClient | null = null;

export function getTwilioClient(): TwilioClient {
  if (!client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && apiKeySid && apiKeySecret) {
      client = createTwilioClient({ accountSid, username: apiKeySid, password: apiKeySecret });
    } else if (accountSid && authToken) {
      client = createTwilioClient({ accountSid, username: accountSid, password: authToken });
    } else {
      throw new Error(
        "Missing Twilio credentials. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN, or TWILIO_ACCOUNT_SID + TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET"
      );
    }
  }
  return client;
}

export function getTwilioSendOptions(): { messagingServiceSid?: string; from?: string; statusCallback?: string } {
  const callback = process.env.TWILIO_WEBHOOK_URL ? { statusCallback: process.env.TWILIO_WEBHOOK_URL } : {};
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (messagingServiceSid) {
    return { messagingServiceSid, ...callback };
  }
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (fromNumber) {
    return { from: fromNumber, ...callback };
  }
  throw new Error("Missing TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER");
}

export function isTwilioConfigured(): boolean {
  const hasAccountSid = !!process.env.TWILIO_ACCOUNT_SID;
  const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
  const hasApiKey = !!process.env.TWILIO_API_KEY_SID && !!process.env.TWILIO_API_KEY_SECRET;
  const hasSender = !!process.env.TWILIO_MESSAGING_SERVICE_SID || !!process.env.TWILIO_FROM_NUMBER;

  return hasAccountSid && (hasAuthToken || hasApiKey) && hasSender;
}
