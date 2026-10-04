import assert from "node:assert/strict";
import test from "node:test";

import {
  ORGANIZER_PRICE_ENV,
  buildAnnualProCheckoutParams,
  buildOrganizerCheckoutParams,
  isOrganizerCheckoutAvailable,
  isOrganizerPlan,
  isStripeKeyAllowed,
  organizationPlanForSubscription,
  organizerPlanPriceId,
  toStoredSubscriptionStatus,
} from "../src/lib/billing";

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

test("organizer checkout bills the workspace with server-set metadata", () => {
  const params = buildOrganizerCheckoutParams({
    organizationId: "5d0f6a43-9a42-4c1e-9d4f-3f6c1f0b8a11",
    userId: "7a7c1f66-48a8-44f6-a268-07ea1fe77b24",
    userEmail: "owner@example.com",
    plan: "studio",
    priceId: "price_organizer_studio",
    siteUrl: "https://sealsend.app",
  });

  assert.equal(params.mode, "subscription");
  assert.deepEqual(params.line_items, [{ price: "price_organizer_studio", quantity: 1 }]);
  assert.deepEqual(params.metadata, {
    kind: "organizer_plan",
    organizationId: "5d0f6a43-9a42-4c1e-9d4f-3f6c1f0b8a11",
    plan: "studio",
    userId: "7a7c1f66-48a8-44f6-a268-07ea1fe77b24",
  });
  assert.deepEqual(params.subscription_data?.metadata, params.metadata);
  assert.equal(params.client_reference_id, "5d0f6a43-9a42-4c1e-9d4f-3f6c1f0b8a11");
  assert.equal(params.success_url, "https://sealsend.app/settings/team?upgraded=studio");
  assert.equal(params.cancel_url, "https://sealsend.app/settings/team?checkout=cancelled");
});

test("organizer checkout refuses a missing Stripe price", () => {
  assert.throws(
    () => buildOrganizerCheckoutParams({
      organizationId: "5d0f6a43-9a42-4c1e-9d4f-3f6c1f0b8a11",
      userId: "7a7c1f66-48a8-44f6-a268-07ea1fe77b24",
      plan: "solo",
      priceId: "",
      siteUrl: "https://sealsend.app",
    }),
    /STRIPE_ORGANIZER_SOLO_PRICE_ID/,
  );
});

test("organizer plans are recognised only by their known ids", () => {
  assert.equal(isOrganizerPlan("solo"), true);
  assert.equal(isOrganizerPlan("studio"), true);
  assert.equal(isOrganizerPlan("agency"), true);
  assert.equal(isOrganizerPlan("personal"), false);
  assert.equal(isOrganizerPlan("constructor"), false);
  assert.equal(isOrganizerPlan(undefined), false);
});

test("organizer checkout needs an allowed test key and the plan's price", () => {
  const keys = ["STRIPE_SECRET_KEY", "PAYMENTS_TEST_ONLY", ORGANIZER_PRICE_ENV.agency];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.PAYMENTS_TEST_ONLY = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    delete process.env[ORGANIZER_PRICE_ENV.agency];
    assert.equal(isOrganizerCheckoutAvailable("agency"), false);

    process.env[ORGANIZER_PRICE_ENV.agency] = " price_agency ";
    assert.equal(organizerPlanPriceId("agency"), "price_agency");
    assert.equal(isOrganizerCheckoutAvailable("agency"), true);

    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    assert.equal(isOrganizerCheckoutAvailable("agency"), false);
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("only active or trialing workspace subscriptions unlock organizer plans", () => {
  assert.equal(organizationPlanForSubscription("solo", "active"), "solo");
  assert.equal(organizationPlanForSubscription("agency", "trialing"), "agency");
  assert.equal(organizationPlanForSubscription("studio", "past_due"), "personal");
  assert.equal(organizationPlanForSubscription("studio", "canceled"), "personal");
});
