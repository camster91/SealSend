import assert from "node:assert/strict";
import test from "node:test";

import { getProviderReadiness } from "../src/lib/provider-readiness";

test("provider readiness reports configuration without returning credentials", () => {
  const readiness = getProviderReadiness({
    PAYMENTS_TEST_ONLY: "true", COMMUNICATIONS_TEST_ONLY: "true",
    STRIPE_SECRET_KEY: "sk_test_private-value", STRIPE_WEBHOOK_SECRET: "whsec_private-value", STRIPE_PRO_YEARLY_PRICE_ID: "price_private-value",
    MAILGUN_API_KEY: "key-private-value", MAILGUN_DOMAIN: "mg.example.com", MAILGUN_WEBHOOK_SIGNING_KEY: "private-signing-key",
    TWILIO_ACCOUNT_SID: "ACprivate", TWILIO_AUTH_TOKEN: "private-token", TWILIO_MESSAGING_SERVICE_SID: "MGprivate",
    TWILIO_WEBHOOK_URL: "https://example.com/api/webhooks/twilio", OPENAI_API_KEY: "sk-private", AI_MODEL: "example-model",
  });
  assert.equal(readiness.stripe.sandboxReady, true);
  assert.equal(readiness.mailgun.configured, true);
  assert.equal(readiness.twilio.configured, true);
  assert.equal(readiness.gates.providerSandboxConfigured, true);
  assert.equal(readiness.gates.externalPaymentsEnabled, false);
  assert.equal(readiness.gates.externalCommunicationsEnabled, false);
  const serialized = JSON.stringify(readiness);
  for (const secret of ["private-value", "private-token", "private-signing-key", "sk-private"]) assert.equal(serialized.includes(secret), false);
});

test("provider readiness fails closed for live Stripe in test-only mode and partial callbacks", () => {
  const readiness = getProviderReadiness({
    PAYMENTS_TEST_ONLY: "true", COMMUNICATIONS_TEST_ONLY: "true",
    STRIPE_SECRET_KEY: "sk_live_private", STRIPE_WEBHOOK_SECRET: "whsec_private", STRIPE_PRO_YEARLY_PRICE_ID: "price_private",
    MAILGUN_API_KEY: "key-private", MAILGUN_DOMAIN: "mg.example.com",
    TWILIO_ACCOUNT_SID: "ACprivate", TWILIO_API_KEY_SID: "SKprivate", TWILIO_API_KEY_SECRET: "private", TWILIO_MESSAGING_SERVICE_SID: "MGprivate",
  });
  assert.equal(readiness.stripe.sandboxReady, false);
  assert.equal(readiness.mailgun.configured, false);
  assert.equal(readiness.twilio.configured, false);
  assert.equal(readiness.gates.providerSandboxConfigured, false);
});
