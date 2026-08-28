export type DeliveryChannel = "email" | "sms";

type Recipient = { email: string | null; phone: string | null; smsSegments?: number };

const GSM_BASIC = new Set(Array.from("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"));
const GSM_EXTENDED = new Set(Array.from("^{}\\[~]|€"));

export function countSmsSegments(text: string): number {
  if (text.length === 0) return 0;
  let septets = 0;
  let gsm = true;
  for (const character of text) {
    if (GSM_BASIC.has(character)) septets += 1;
    else if (GSM_EXTENDED.has(character)) septets += 2;
    else { gsm = false; break; }
  }
  if (gsm) return septets <= 160 ? 1 : Math.ceil(septets / 153);
  const unicodeUnits = text.length;
  return unicodeUnits <= 70 ? 1 : Math.ceil(unicodeUnits / 67);
}

function parseRate(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

export function estimateDeliveryCost(
  recipients: Recipient[],
  channels: DeliveryChannel[],
  rates: { emailMicros?: string; smsMicros?: string },
) {
  const emailSelected = channels.includes("email");
  const smsSelected = channels.includes("sms");
  const emailCount = emailSelected ? recipients.filter((recipient) => Boolean(recipient.email)).length : 0;
  const smsCount = smsSelected ? recipients.filter((recipient) => Boolean(recipient.phone)).length : 0;
  const smsSegmentCount = smsSelected
    ? recipients.reduce((total, recipient) => total + (recipient.phone ? Math.max(1, recipient.smsSegments ?? 1) : 0), 0)
    : 0;
  const emailRate = parseRate(rates.emailMicros);
  const smsRate = parseRate(rates.smsMicros);
  const costConfigured = (!emailSelected || emailRate !== null) && (!smsSelected || smsRate !== null);

  return {
    emailCount,
    smsCount,
    smsSegmentCount,
    costConfigured,
    estimatedCostMicros: costConfigured
      ? emailCount * (emailRate ?? 0) + smsSegmentCount * (smsRate ?? 0)
      : null,
  };
}
