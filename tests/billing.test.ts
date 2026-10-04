import assert from "node:assert/strict";
import test from "node:test";

import {
  ORGANIZER_PRICE_ENV,
  assertStripeTestKey,
  buildAnnualProCheckoutParams,
  buildOrganizerCheckoutParams,
  buildOrganizerPlanChangeParams,
  changeOrganizerSubscriptionPlan,
  invoiceSubscriptionId,
  isOrganizerCheckoutAvailable,
  isOrganizerPlan,
  isStripeKeyAllowed,
  organizationPlanForSubscription,
  organizerPlanForPrice,
  organizerPlanFromSubscription,
  organizerPlanPriceId,
  setOrganizerSubscriptionCancellation,
  subscriptionPeriodEnd,
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

test("Stripe tooling refuses anything but a test-mode secret key", () => {
  assert.equal(assertStripeTestKey(" sk_test_abc "), "sk_test_abc");
  assert.throws(() => assertStripeTestKey(undefined), /not set/);
  assert.throws(() => assertStripeTestKey(""), /not set/);
  assert.throws(() => assertStripeTestKey("sk_live_abc"), /must start with sk_test_/);
  assert.throws(() => assertStripeTestKey("rk_test_abc"), /must start with sk_test_/);
  assert.throws(() => assertStripeTestKey("pk_test_abc"), /must start with sk_test_/);
});

test("billing period end is read from subscription items, with the pre-2025 field as fallback", () => {
  assert.equal(
    subscriptionPeriodEnd({ items: { data: [{ current_period_end: 1_800_000_000 }, { current_period_end: 1_800_000_100 }] } }),
    new Date(1_800_000_100 * 1000).toISOString(),
  );
  assert.equal(subscriptionPeriodEnd({ current_period_end: 1_700_000_000, items: { data: [] } }), new Date(1_700_000_000 * 1000).toISOString());
  assert.equal(subscriptionPeriodEnd({ items: { data: [] } }), null);
});

test("invoice subscription is read from invoice.parent, with the pre-2025 field as fallback", () => {
  assert.equal(invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_new" } } }), "sub_new");
  assert.equal(invoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: "sub_expanded" } } } }), "sub_expanded");
  assert.equal(invoiceSubscriptionId({ subscription: "sub_legacy" }), "sub_legacy");
  assert.equal(invoiceSubscriptionId({ parent: null, subscription: null }), null);
  assert.equal(invoiceSubscriptionId({}), null);
});

test("the billed organizer price decides the plan, so outside upgrades and downgrades apply", () => {
  const env = {
    [ORGANIZER_PRICE_ENV.solo]: "price_solo",
    [ORGANIZER_PRICE_ENV.studio]: "price_studio",
    [ORGANIZER_PRICE_ENV.agency]: "price_agency",
  } as NodeJS.ProcessEnv;

  assert.equal(organizerPlanForPrice("price_studio", env), "studio");
  assert.equal(organizerPlanForPrice("price_other", env), null);
  assert.equal(organizerPlanForPrice(undefined, env), null);

  // Upgraded in Stripe: metadata still says solo, the price says agency.
  assert.equal(organizerPlanFromSubscription({ metadata: { plan: "solo" }, items: { data: [{ price: { id: "price_agency" } }] } }, env), "agency");
  // An unknown price falls back to metadata; unknown metadata gives nothing.
  assert.equal(organizerPlanFromSubscription({ metadata: { plan: "studio" }, items: { data: [{ price: { id: "price_other" } }] } }, env), "studio");
  assert.equal(organizerPlanFromSubscription({ metadata: { plan: "enterprise" }, items: { data: [] } }, env), null);
});

test("organizer plan changes swap the existing item and prorate", () => {
  const params = buildOrganizerPlanChangeParams({
    organizationId: "5d0f6a43-9a42-4c1e-9d4f-3f6c1f0b8a11",
    userId: "7a7c1f66-48a8-44f6-a268-07ea1fe77b24",
    plan: "agency",
    priceId: "price_agency",
    subscriptionItemId: "si_123",
  });
  assert.deepEqual(params.items, [{ id: "si_123", price: "price_agency" }]);
  assert.equal(params.proration_behavior, "create_prorations");
  assert.equal(params.cancel_at_period_end, false);
  assert.deepEqual(params.metadata, {
    kind: "organizer_plan",
    organizationId: "5d0f6a43-9a42-4c1e-9d4f-3f6c1f0b8a11",
    plan: "agency",
    userId: "7a7c1f66-48a8-44f6-a268-07ea1fe77b24",
  });
  assert.throws(
    () => buildOrganizerPlanChangeParams({ organizationId: "o", userId: "u", plan: "studio", priceId: "", subscriptionItemId: "si_1" }),
    /STRIPE_ORGANIZER_STUDIO_PRICE_ID/,
  );
});

type FakeSubscription = { metadata: Record<string, string>; status: string; items: { data: Array<{ id: string }> } };

function fakeSubscriptions(subscription: FakeSubscription) {
  const updates: Array<{ id: string; params: unknown }> = [];
  const api = {
    subscriptions: {
      retrieve: async () => subscription,
      update: async (id: string, params: unknown) => {
        updates.push({ id, params });
        return { id, ...subscription };
      },
    },
  } as unknown as Parameters<typeof changeOrganizerSubscriptionPlan>[0];
  return { api, updates };
}

test("plan changes and cancellations refuse another workspace's subscription", async () => {
  const organizationId = "5d0f6a43-9a42-4c1e-9d4f-3f6c1f0b8a11";
  const { api, updates } = fakeSubscriptions({ metadata: { organizationId: "someone-else" }, status: "active", items: { data: [{ id: "si_1" }] } });

  await assert.rejects(
    changeOrganizerSubscriptionPlan(api, { subscriptionId: "sub_1", organizationId, userId: "u", plan: "studio", priceId: "price_studio" }),
    /does not belong/,
  );
  await assert.rejects(setOrganizerSubscriptionCancellation(api, { subscriptionId: "sub_1", organizationId, cancel: true }), /does not belong/);
  assert.equal(updates.length, 0);
});

test("plan changes update the subscription's own item; cancellation waits for period end", async () => {
  const organizationId = "5d0f6a43-9a42-4c1e-9d4f-3f6c1f0b8a11";
  const { api, updates } = fakeSubscriptions({ metadata: { organizationId }, status: "active", items: { data: [{ id: "si_1" }] } });

  await changeOrganizerSubscriptionPlan(api, { subscriptionId: "sub_1", organizationId, userId: "u", plan: "studio", priceId: "price_studio" });
  await setOrganizerSubscriptionCancellation(api, { subscriptionId: "sub_1", organizationId, cancel: true });
  await setOrganizerSubscriptionCancellation(api, { subscriptionId: "sub_1", organizationId, cancel: false });

  assert.deepEqual((updates[0].params as { items: unknown }).items, [{ id: "si_1", price: "price_studio" }]);
  assert.deepEqual(updates[1].params, { cancel_at_period_end: true });
  assert.deepEqual(updates[2].params, { cancel_at_period_end: false });

  const cancelled = fakeSubscriptions({ metadata: { organizationId }, status: "canceled", items: { data: [{ id: "si_1" }] } });
  await assert.rejects(
    changeOrganizerSubscriptionPlan(cancelled.api, { subscriptionId: "sub_1", organizationId, userId: "u", plan: "agency", priceId: "price_agency" }),
    /no longer active/,
  );
});
