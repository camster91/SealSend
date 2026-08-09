import assert from "node:assert/strict";
import test from "node:test";

import { buildAnnualProCheckoutParams, isStripeKeyAllowed, toStoredSubscriptionStatus } from "../src/lib/billing";

test("annual Pro checkout uses the configured recurring Stripe price", () => {
  const params = buildAnnualProCheckoutParams({
    userId: "7a7c1f66-48a8-44f6-a268-07ea1fe77b24",
    userEmail: "host@example.com",
    priceId: "price_pro_annual",
    siteUrl: "https://sealsend.app",
  });

  assert.equal(params.mode, "subscription");
  assert.deepEqual(params.line_items, [{ price: "price_pro_annual", quantity: 1 }]);
  assert.deepEqual(params.metadata, {
    userId: "7a7c1f66-48a8-44f6-a268-07ea1fe77b24",
    tier: "pro_annual",
    billing: "yearly",
  });
  assert.deepEqual(params.subscription_data?.metadata, params.metadata);
  assert.equal(params.customer_email, "host@example.com");
  assert.equal(params.success_url, "https://sealsend.app/dashboard?upgraded=true");
  assert.equal(params.cancel_url, "https://sealsend.app/pricing");
});

test("annual Pro checkout refuses a missing Stripe price", () => {
  assert.throws(
    () => buildAnnualProCheckoutParams({
      userId: "7a7c1f66-48a8-44f6-a268-07ea1fe77b24",
      priceId: "",
      siteUrl: "https://sealsend.app",
    }),
    /STRIPE_PRO_YEARLY_PRICE_ID/,
  );
});

test("test-only billing refuses live Stripe keys", () => {
  const previous = process.env.PAYMENTS_TEST_ONLY;
  process.env.PAYMENTS_TEST_ONLY = 'true';
  try {
    assert.equal(isStripeKeyAllowed('sk_live_example'), false);
    assert.equal(isStripeKeyAllowed('sk_test_example'), true);
  } finally {
    if (previous === undefined) delete process.env.PAYMENTS_TEST_ONLY;
    else process.env.PAYMENTS_TEST_ONLY = previous;
  }
});

test("Stripe subscription states fail closed to entitlement-safe stored states", () => {
  assert.equal(toStoredSubscriptionStatus("active"), "active");
  assert.equal(toStoredSubscriptionStatus("trialing"), "trialing");
  assert.equal(toStoredSubscriptionStatus("past_due"), "past_due");
  assert.equal(toStoredSubscriptionStatus("incomplete"), "past_due");
  assert.equal(toStoredSubscriptionStatus("paused"), "past_due");
  assert.equal(toStoredSubscriptionStatus("unpaid"), "canceled");
  assert.equal(toStoredSubscriptionStatus("incomplete_expired"), "canceled");
  assert.equal(toStoredSubscriptionStatus("canceled"), "canceled");
});
