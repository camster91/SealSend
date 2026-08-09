type ProviderEnvironment = Record<string, string | undefined>;

function configured(value: string | undefined, placeholders: string[] = []): boolean {
  return Boolean(value && !placeholders.some((placeholder) => value.includes(placeholder)));
}

export function getProviderReadiness(env: ProviderEnvironment = process.env) {
  const stripeKey = env.STRIPE_SECRET_KEY ?? "";
  const stripeKeyMode = stripeKey.startsWith("sk_test_") ? "test" : stripeKey.startsWith("sk_live_") ? "live" : "unknown";
  const paymentsTestOnly = env.PAYMENTS_TEST_ONLY === "true";
  const communicationsTestOnly = env.COMMUNICATIONS_TEST_ONLY === "true";
  const stripe = {
    secretKey: configured(stripeKey, ["your-stripe"]),
    keyMode: stripeKeyMode,
    webhookSecret: configured(env.STRIPE_WEBHOOK_SECRET, ["your-stripe"]),
    annualPrice: configured(env.STRIPE_PRO_YEARLY_PRICE_ID, ["your-pro"]),
  };
  const mailgun = {
    apiKey: configured(env.MAILGUN_API_KEY, ["your-mailgun"]),
    domain: configured(env.MAILGUN_DOMAIN),
    webhookSigningKey: configured(env.MAILGUN_WEBHOOK_SIGNING_KEY),
  };
  const twilioCredentials = configured(env.TWILIO_ACCOUNT_SID, ["your-twilio"])
    && (configured(env.TWILIO_AUTH_TOKEN) || (configured(env.TWILIO_API_KEY_SID, ["your-twilio"]) && configured(env.TWILIO_API_KEY_SECRET, ["your-twilio"])));
  const twilio = {
    credentials: twilioCredentials,
    sender: configured(env.TWILIO_MESSAGING_SERVICE_SID, ["your-twilio"]) || configured(env.TWILIO_FROM_NUMBER),
    webhookAuthToken: configured(env.TWILIO_AUTH_TOKEN),
    webhookUrl: configured(env.TWILIO_WEBHOOK_URL, ["your-domain"]),
  };
  const openai = {
    apiKey: configured(env.OPENAI_API_KEY),
    model: configured(env.AI_MODEL),
    deterministicFallback: true,
  };
  const stripeConfigured = Object.entries(stripe).every(([key, value]) => key === "keyMode" || value === true);
  const mailgunConfigured = Object.values(mailgun).every(Boolean);
  const twilioConfigured = Object.values(twilio).every(Boolean);
  return {
    configurationOnly: true,
    safety: { paymentsTestOnly, communicationsTestOnly },
    stripe: { ...stripe, configured: stripeConfigured, sandboxReady: stripeConfigured && stripeKeyMode === "test" },
    mailgun: { ...mailgun, configured: mailgunConfigured },
    twilio: { ...twilio, configured: twilioConfigured },
    openai: { ...openai, configured: openai.apiKey && openai.model },
    alerting: { webhook: configured(env.ERROR_ALERT_WEBHOOK_URL) },
    gates: {
      providerSandboxConfigured: stripeConfigured && stripeKeyMode === "test" && mailgunConfigured && twilioConfigured,
      externalPaymentsEnabled: !paymentsTestOnly && stripeConfigured && stripeKeyMode === "live",
      externalCommunicationsEnabled: !communicationsTestOnly && mailgunConfigured && twilioConfigured,
    },
  };
}
