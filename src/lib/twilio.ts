import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;

export function getTwilioClient() {
  if (!client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && apiKeySid && apiKeySecret) {
      client = twilio(apiKeySid, apiKeySecret, { accountSid });
    } else if (accountSid && authToken) {
      client = twilio(accountSid, authToken);
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
