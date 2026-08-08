export type DeliveryChannel = "email" | "sms";

type Recipient = { email: string | null; phone: string | null };

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
  const emailRate = parseRate(rates.emailMicros);
  const smsRate = parseRate(rates.smsMicros);
  const costConfigured = (!emailSelected || emailRate !== null) && (!smsSelected || smsRate !== null);

  return {
    emailCount,
    smsCount,
    costConfigured,
    estimatedCostMicros: costConfigured
      ? emailCount * (emailRate ?? 0) + smsCount * (smsRate ?? 0)
      : null,
  };
}
