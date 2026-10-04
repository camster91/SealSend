#!/usr/bin/env tsx
/**
 * Stripe TEST-mode end-to-end run for SealSend billing: `npm run stripe:test-e2e`.
 *
 * What it does, against a Stripe test account and a local database:
 *   1. Finds or creates the test products/prices (by lookup key) for Solo, Studio,
 *      Agency and Pro annual, and prints the price IDs to put in the environment.
 *   2. Creates a disposable host and team workspace in the local database.
 *   3. Checks out the Solo plan with test card 4242 4242 4242 4242 on a Stripe test clock.
 *   4. Delivers the resulting Stripe events, signed, to the real webhook handler and
 *      checks the workspace entitlements after every step: checkout, signed replay,
 *      bad signature, upgrade, downgrade, renewal, failed renewal, recovery, scheduled
 *      cancellation, resume, and cancellation at period end. Then the Pro annual plan.
 *   5. Deletes the test clock (and with it the Stripe customer and subscriptions) and
 *      the database fixtures. Test products and prices are kept for the next run.
 *
 * Safety: refuses to start unless STRIPE_SECRET_KEY starts with sk_test_, forces
 * PAYMENTS_TEST_ONLY=true, aborts on any livemode object, and refuses a non-local
 * DATABASE_URL unless STRIPE_E2E_ALLOW_REMOTE_DB=true.
 *
 * Options:
 *   --checkout=api       (default) Pays with the 4242 test card through the API and builds a
 *                        signed checkout.session.completed from the real test session.
 *   --checkout=browser   Pays on the hosted Checkout page with Playwright (Chromium).
 *   --checkout=manual    Prints the hosted Checkout URL and waits for you to pay with 4242.
 *   --app-url=<url>      POST the signed events to a running app (it must use the same
 *                        DATABASE_URL and STRIPE_WEBHOOK_SECRET) instead of calling the
 *                        webhook handler in-process.
 *   --skip-pro           Skip the Pro annual part.
 *   --keep               Keep the Stripe test clock and database fixtures for inspection.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import * as dotenv from "dotenv";
import { NextRequest } from "next/server";
import Stripe from "stripe";

// These modules read the environment when called, not when imported, so the
// guards below still run before anything touches Stripe or the database.
import { POST as handleStripeWebhook } from "../../src/app/api/webhooks/stripe/route";
import { organizationSeatLimit } from "../../src/lib/auth/organization-access";
import {
  assertStripeTestKey,
  buildAnnualProCheckoutParams,
  buildOrganizerCheckoutParams,
  changeOrganizerSubscriptionPlan,
  invoiceSubscriptionId,
  ORGANIZER_PRICE_ENV,
  setOrganizerSubscriptionCancellation,
} from "../../src/lib/billing";
import { canWhiteLabel } from "../../src/lib/brands";
import { ORGANIZER_PLANS, PRO_ANNUAL, type OrganizerPlan } from "../../src/lib/constants";
import { getDb, query, queryOne } from "../../src/lib/db/client";
import { hashPassword } from "../../src/lib/password";

dotenv.config({ path: [path.resolve(process.cwd(), ".env.local"), path.resolve(process.cwd(), ".env")], quiet: true });

// ---------------------------------------------------------------------------
// Guards: run before anything talks to Stripe or the database.
// ---------------------------------------------------------------------------

const secretKey = assertStripeTestKey(process.env.STRIPE_SECRET_KEY);
process.env.STRIPE_SECRET_KEY = secretKey;
process.env.PAYMENTS_TEST_ONLY = "true";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set. Point it at a local, disposable SealSend database.");
const databaseHost = new URL(databaseUrl).hostname.replace(/^\[|\]$/g, "");
if (!["localhost", "127.0.0.1", "::1", ""].includes(databaseHost) && process.env.STRIPE_E2E_ALLOW_REMOTE_DB !== "true") {
  throw new Error(`Refusing to write test fixtures to non-local database host "${databaseHost}". Set STRIPE_E2E_ALLOW_REMOTE_DB=true only for a disposable database.`);
}

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"] as const;
}));
const checkoutMode = args.get("checkout") ?? "api";
if (!["api", "browser", "manual"].includes(checkoutMode)) throw new Error("--checkout must be api, browser or manual");
const appUrl = args.get("app-url")?.replace(/\/$/, "");
const keep = args.has("keep");
const skipPro = args.has("skip-pro");

// In-process delivery signs with a per-run secret; a running app needs its own secret.
if (appUrl) {
  if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) throw new Error("--app-url needs the app's STRIPE_WEBHOOK_SECRET (whsec_...) in the environment.");
} else {
  process.env.STRIPE_WEBHOOK_SECRET = `whsec_e2e_${randomBytes(24).toString("hex")}`;
}
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

const stripe = new Stripe(secretKey);
const runId = randomBytes(4).toString("hex");
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

type StepResult = { name: string; ok: boolean; detail: string };
const results: StepResult[] = [];
const evidence: Record<string, string> = {};

async function step(name: string, run: () => Promise<string | void>) {
  process.stdout.write(`• ${name} … `);
  try {
    const detail = (await run()) || "";
    results.push({ name, ok: true, detail });
    console.log(`PASS${detail ? ` (${detail})` : ""}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail });
    console.log(`FAIL\n    ${detail}`);
    throw new StepFailed(name);
  }
}

class StepFailed extends Error {}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertTestMode(object: { livemode?: boolean } | null | undefined, label: string) {
  if (object?.livemode) throw new Error(`Aborting: Stripe returned a livemode ${label}. This run only uses test mode.`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Stripe test catalog
// ---------------------------------------------------------------------------

type CatalogEntry = { lookupKey: string; name: string; unitAmount: number; interval: "month" | "year"; envVar: string };

const CATALOG: Record<OrganizerPlan | "pro_annual", CatalogEntry> = {
  solo: { lookupKey: "sealsend_test_organizer_solo_monthly", name: "SealSend Solo (test)", unitAmount: ORGANIZER_PLANS.solo.monthlyPriceCents, interval: "month", envVar: ORGANIZER_PRICE_ENV.solo },
  studio: { lookupKey: "sealsend_test_organizer_studio_monthly", name: "SealSend Studio (test)", unitAmount: ORGANIZER_PLANS.studio.monthlyPriceCents, interval: "month", envVar: ORGANIZER_PRICE_ENV.studio },
  agency: { lookupKey: "sealsend_test_organizer_agency_monthly", name: "SealSend Agency (test)", unitAmount: ORGANIZER_PLANS.agency.monthlyPriceCents, interval: "month", envVar: ORGANIZER_PRICE_ENV.agency },
  pro_annual: { lookupKey: "sealsend_test_pro_annual", name: "SealSend Pro annual (test)", unitAmount: Math.round(PRO_ANNUAL.price * 100), interval: "year", envVar: "STRIPE_PRO_YEARLY_PRICE_ID" },
};

async function ensurePrice(entry: CatalogEntry): Promise<string> {
  const configured = process.env[entry.envVar]?.trim();
  if (configured && !configured.startsWith("price_your-")) {
    const price = await stripe.prices.retrieve(configured);
    assertTestMode(price, "price");
    check(price.active && price.recurring?.interval === entry.interval, `${entry.envVar}=${configured} must be an active recurring ${entry.interval}ly test price`);
    return price.id;
  }
  const existing = await stripe.prices.list({ lookup_keys: [entry.lookupKey], active: true, limit: 1 });
  if (existing.data[0]) {
    assertTestMode(existing.data[0], "price");
    return existing.data[0].id;
  }
  const product = await stripe.products.create({ name: entry.name, metadata: { sealsend_e2e: "true" } });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: entry.unitAmount,
    recurring: { interval: entry.interval },
    lookup_key: entry.lookupKey,
    metadata: { sealsend_e2e: "true" },
  });
  assertTestMode(price, "price");
  return price.id;
}

// ---------------------------------------------------------------------------
// Webhook delivery: real Stripe test events, signed and sent to the handler.
// ---------------------------------------------------------------------------

const HANDLED_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

const runStartedAt = Math.floor(Date.now() / 1000) - 5;
const relatedIds = new Set<string>();
const delivered = new Set<string>();

function idOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return typeof value === "object" && "id" in value ? String((value as { id: unknown }).id) : null;
}

function isRelated(event: Stripe.Event): boolean {
  const object = event.data.object as unknown as Record<string, unknown>;
  const candidates = [
    idOf(object.id),
    idOf(object.customer),
    idOf(object.subscription),
    invoiceSubscriptionId(object as Parameters<typeof invoiceSubscriptionId>[0]),
  ];
  return candidates.some((id) => id !== null && relatedIds.has(id));
}

async function sendSigned(payload: string, secret = webhookSecret): Promise<{ status: number; body: Record<string, unknown> }> {
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  if (appUrl) {
    const response = await fetch(`${appUrl}/api/webhooks/stripe`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": signature }, body: payload });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }
  const request = new NextRequest("http://localhost/api/webhooks/stripe", { method: "POST", headers: { "content-type": "application/json", "stripe-signature": signature }, body: payload });
  const response = await handleStripeWebhook(request);
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function deliver(event: Stripe.Event | Record<string, unknown>): Promise<Record<string, unknown>> {
  assertTestMode(event as { livemode?: boolean }, "event");
  const { status, body } = await sendSigned(JSON.stringify(event));
  check(status === 200, `webhook returned HTTP ${status} for ${(event as { type: string }).type} ${(event as { id: string }).id}: ${JSON.stringify(body)}`);
  delivered.add((event as { id: string }).id);
  return body;
}

async function relatedEvents(): Promise<Stripe.Event[]> {
  const events: Stripe.Event[] = [];
  for await (const event of stripe.events.list({ created: { gte: runStartedAt }, limit: 100 })) {
    if (HANDLED_TYPES.has(event.type) && isRelated(event)) events.push(event);
  }
  return events.sort((a, b) => a.created - b.created);
}

/**
 * Waits until a matching real Stripe event exists, then delivers every
 * not-yet-delivered related event in creation order (as Stripe would), and
 * returns the match. A match delivered by an earlier sweep still counts.
 */
async function deliverUntil(description: string, matches: (event: Stripe.Event) => boolean, timeoutMs = 120_000): Promise<Stripe.Event> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = (await relatedEvents()).find(matches);
    if (match) {
      await sleep(2000); // let any sibling events from the same change appear
      const settled = (await relatedEvents()).filter((event) => !delivered.has(event.id));
      for (const event of settled) await deliver(event);
      return match;
    }
    await sleep(2000);
  }
  throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for Stripe event: ${description}`);
}

function subscriptionPrice(event: Stripe.Event): string | null {
  const subscription = event.data.object as Stripe.Subscription;
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

// ---------------------------------------------------------------------------
// Test clock helpers
// ---------------------------------------------------------------------------

async function advanceClock(clockId: string, frozenTime: number) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: frozenTime });
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === "ready") return;
    if (clock.status === "internal_failure") throw new Error("Stripe test clock failed to advance");
    await sleep(2000);
  }
  throw new Error("Timed out waiting for the Stripe test clock to advance");
}

async function periodEnd(subscriptionId: string): Promise<number> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const ends = subscription.items.data.map((item) => item.current_period_end);
  check(ends.length > 0, "subscription has no items");
  return Math.max(...ends);
}

// ---------------------------------------------------------------------------
// Database fixtures and entitlement checks
// ---------------------------------------------------------------------------

async function ensureSchema() {
  const hasUsers = await queryOne<{ ok: boolean }>("SELECT to_regclass('public.admin_users') IS NOT NULL AS ok");
  if (!hasUsers?.ok) {
    await query(await readFile(path.resolve("src/lib/db/schema.sql"), "utf8"));
    return "fresh schema applied";
  }
  const hasColumn = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns
       WHERE table_name = 'organization_subscriptions' AND column_name = 'cancel_at_period_end') AS ok`,
  );
  if (!hasColumn?.ok) {
    await query(await readFile(path.resolve("apply-security-indexes.sql"), "utf8"));
    return "idempotent migration applied";
  }
  return "schema current";
}

type WorkspaceState = {
  plan: string;
  status: string | null;
  sub_plan: string | null;
  stripe_subscription_id: string | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean | null;
};

async function workspaceState(organizationId: string): Promise<WorkspaceState> {
  const row = await queryOne<WorkspaceState>(
    `SELECT o.plan, s.status, s.plan AS sub_plan, s.stripe_subscription_id, s.current_period_end, s.cancel_at_period_end
       FROM organizations o LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
      WHERE o.id = $1`,
    [organizationId],
  );
  check(row, "workspace fixture disappeared");
  return row;
}

/** Entitlements the product derives from organizations.plan: seats and white-label. */
function expectEntitlements(state: WorkspaceState, plan: OrganizerPlan | "personal") {
  check(state.plan === plan, `workspace plan is "${state.plan}", expected "${plan}"`);
  const seats = organizationSeatLimit(state.plan);
  const expectedSeats = plan === "personal" ? organizationSeatLimit("personal") : ORGANIZER_PLANS[plan].seats;
  check(seats === expectedSeats, `seat limit is ${seats}, expected ${expectedSeats}`);
  check(canWhiteLabel(state.plan) === (plan !== "personal"), `white-label is ${canWhiteLabel(state.plan) ? "on" : "off"} for plan ${plan}`);
  return `${plan}: ${seats} seats, white-label ${plan === "personal" ? "off" : "on"}`;
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

async function payHostedCheckout(url: string) {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const cardTab = page.locator('[data-testid="card-accordion-item-button"]');
    if (await cardTab.isVisible().catch(() => false)) await cardTab.click();
    await page.locator("#cardNumber").fill("4242424242424242");
    await page.locator("#cardExpiry").fill("12 / 34");
    await page.locator("#cardCvc").fill("123");
    await page.locator("#billingName").fill("SealSend Test");
    const postal = page.locator("#billingPostalCode");
    if (await postal.isVisible().catch(() => false)) await postal.fill("M5V 2T6");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((target) => target.toString().startsWith(siteUrl), { timeout: 90_000, waitUntil: "commit" });
  } finally {
    await browser.close();
  }
}

async function waitForCheckoutComplete(sessionId: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "complete") return session;
    if (session.status === "expired") throw new Error("Checkout session expired before payment");
    await sleep(3000);
  }
  throw new Error("Timed out waiting for the Checkout session to complete");
}

/** A checkout.session.completed event for a session paid through the API, built from the real test session. */
function syntheticCheckoutCompleted(session: Stripe.Checkout.Session, subscriptionId: string, customerId: string) {
  return {
    id: `evt_e2e_${randomBytes(8).toString("hex")}`,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    api_version: Stripe.API_VERSION,
    data: { object: { ...session, status: "complete", payment_status: "paid", subscription: subscriptionId, customer: customerId } },
  };
}

/**
 * Pays a subscription checkout with the 4242 test card. Returns the subscription and the
 * checkout.session.completed event that was delivered.
 */
async function checkout(params: Stripe.Checkout.SessionCreateParams, customerId: string, cardPaymentMethod: string) {
  const session = await stripe.checkout.sessions.create({ ...params, customer: customerId, customer_email: undefined });
  assertTestMode(session, "checkout session");
  relatedIds.add(session.id);

  if (checkoutMode === "api") {
    await stripe.checkout.sessions.expire(session.id);
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: params.line_items!.map((item) => ({ price: item.price as string, quantity: item.quantity })),
      default_payment_method: cardPaymentMethod,
      metadata: params.subscription_data?.metadata,
      payment_behavior: "error_if_incomplete",
    });
    assertTestMode(subscription, "subscription");
    relatedIds.add(subscription.id);
    check(subscription.status === "active", `4242 subscription status is ${subscription.status}`);
    const event = syntheticCheckoutCompleted(session, subscription.id, customerId);
    return { sessionId: session.id, subscriptionId: subscription.id, event };
  }

  if (checkoutMode === "browser") await payHostedCheckout(session.url!);
  else console.log(`\n    Open this test Checkout page and pay with 4242 4242 4242 4242, any future date, any CVC:\n    ${session.url}\n`);
  const completed = await waitForCheckoutComplete(session.id, checkoutMode === "manual" ? 600_000 : 120_000);
  const subscriptionId = idOf(completed.subscription);
  check(subscriptionId, "completed checkout has no subscription");
  relatedIds.add(subscriptionId);
  const event = await deliverUntil("checkout.session.completed", (e) => e.type === "checkout.session.completed" && idOf((e.data.object as Stripe.Checkout.Session).id) === session.id);
  return { sessionId: session.id, subscriptionId, event };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`SealSend Stripe TEST-mode end-to-end run ${runId}`);
  console.log(`Checkout: ${checkoutMode}. Webhooks: ${appUrl ? `signed POSTs to ${appUrl}` : "signed, delivered in-process to the webhook handler"}.\n`);

  const prices = {} as Record<OrganizerPlan | "pro_annual", string>;
  let clockId: string | null = null;
  let userId: string | null = null;
  let organizationId: string | null = null;

  try {
    await step("Stripe key is test mode and the account answers", async () => {
      const balance = await stripe.balance.retrieve();
      assertTestMode(balance, "balance");
      return "sk_test_ key, livemode=false";
    });

    await step("Local database schema", ensureSchema);

    await step("Test products and prices (lookup or create)", async () => {
      for (const key of Object.keys(CATALOG) as (keyof typeof CATALOG)[]) {
        prices[key] = await ensurePrice(CATALOG[key]);
        process.env[CATALOG[key].envVar] = prices[key];
      }
      return Object.values(prices).join(", ");
    });

    await step("Disposable host and team workspace", async () => {
      const user = await queryOne<{ id: string }>(
        "INSERT INTO admin_users (email, password, name) VALUES ($1, $2, $3) RETURNING id",
        [`stripe-e2e+${runId}@example.test`, await hashPassword(randomUUID()), "Stripe E2E Owner"],
      );
      userId = user!.id;
      const organization = await queryOne<{ id: string }>(
        "INSERT INTO organizations (name, slug, plan, is_personal, created_by) VALUES ($1, $2, 'personal', FALSE, $3) RETURNING id",
        [`Stripe E2E ${runId}`, `stripe-e2e-${runId}`, userId],
      );
      organizationId = organization!.id;
      await query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')", [organizationId, userId]);
      return expectEntitlements(await workspaceState(organizationId), "personal");
    });
    const orgId = organizationId as unknown as string;
    const ownerId = userId as unknown as string;

    let customerId = "";
    let visa = "";
    await step("Test clock and customer with the 4242 card", async () => {
      const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name: `sealsend-e2e-${runId}` });
      assertTestMode(clock, "test clock");
      clockId = clock.id;
      const customer = await stripe.customers.create({ email: `stripe-e2e+${runId}@example.test`, test_clock: clock.id, metadata: { sealsend_e2e: runId } });
      assertTestMode(customer, "customer");
      customerId = customer.id;
      relatedIds.add(customerId);
      // pm_card_visa is Stripe's test PaymentMethod for 4242 4242 4242 4242.
      visa = (await stripe.paymentMethods.attach("pm_card_visa", { customer: customerId })).id;
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: visa } });
      return `${clock.id}, ${customerId}`;
    });

    let subscriptionId = "";
    let checkoutEvent: Stripe.Event | Record<string, unknown> = {};
    await step("Checkout Solo with test card 4242", async () => {
      const params = buildOrganizerCheckoutParams({ organizationId: orgId, userId: ownerId, userEmail: null, plan: "solo", priceId: prices.solo, siteUrl });
      const result = await checkout(params, customerId, visa);
      subscriptionId = result.subscriptionId;
      checkoutEvent = result.event;
      evidence.checkoutSession = result.sessionId;
      evidence.subscription = subscriptionId;
      return `${result.sessionId} → ${subscriptionId}`;
    });

    await step("Webhook: checkout completed unlocks Solo", async () => {
      if (checkoutMode === "api") await deliver(checkoutEvent);
      await deliverUntil("first invoice paid", (e) => e.type === "invoice.paid" && invoiceSubscriptionId(e.data.object as Stripe.Invoice) === subscriptionId);
      const state = await workspaceState(orgId);
      check(state.status === "active" && state.stripe_subscription_id === subscriptionId, `stored subscription is ${state.status} ${state.stripe_subscription_id}`);
      evidence.checkoutEvent = String((checkoutEvent as { id: string }).id);
      return expectEntitlements(state, "solo");
    });

    await step("Webhook: replayed event is acknowledged once and changes nothing", async () => {
      const before = await workspaceState(orgId);
      const { status, body } = await sendSigned(JSON.stringify(checkoutEvent));
      check(status === 200 && body.duplicate === true, `replay returned HTTP ${status} ${JSON.stringify(body)}`);
      const after = await workspaceState(orgId);
      check(JSON.stringify(before) === JSON.stringify(after), "replay changed the stored subscription");
      return "duplicate: true";
    });

    await step("Webhook: bad signature is rejected", async () => {
      const { status } = await sendSigned(JSON.stringify({ ...checkoutEvent, id: `evt_e2e_forged_${runId}` }), `whsec_wrong_${runId}`);
      check(status === 400, `forged event returned HTTP ${status}`);
      return "HTTP 400";
    });

    await step("Upgrade Solo → Studio", async () => {
      await changeOrganizerSubscriptionPlan(stripe, { subscriptionId, organizationId: orgId, userId: ownerId, plan: "studio", priceId: prices.studio });
      await deliverUntil("subscription updated to Studio", (e) => e.type === "customer.subscription.updated" && subscriptionPrice(e) === prices.studio);
      return expectEntitlements(await workspaceState(orgId), "studio");
    });

    await step("Downgrade Studio → Solo", async () => {
      await changeOrganizerSubscriptionPlan(stripe, { subscriptionId, organizationId: orgId, userId: ownerId, plan: "solo", priceId: prices.solo });
      await deliverUntil("subscription updated to Solo", (e) => e.type === "customer.subscription.updated" && subscriptionPrice(e) === prices.solo);
      return expectEntitlements(await workspaceState(orgId), "solo");
    });

    await step("Renewal invoice paid keeps Solo and advances the period", async () => {
      const before = await workspaceState(orgId);
      const end = await periodEnd(subscriptionId);
      await advanceClock(clockId!, end + 2 * 3600);
      await deliverUntil("renewal invoice paid", (e) => e.type === "invoice.paid" && (e.data.object as Stripe.Invoice).billing_reason === "subscription_cycle" && invoiceSubscriptionId(e.data.object as Stripe.Invoice) === subscriptionId);
      await deliverUntil("subscription period advanced", (e) => e.type === "customer.subscription.updated" && (e.data.object as Stripe.Subscription).items.data.some((item) => item.current_period_end > end));
      const after = await workspaceState(orgId);
      check(after.status === "active", `status is ${after.status}`);
      check(after.current_period_end && (!before.current_period_end || after.current_period_end > before.current_period_end), "current_period_end did not advance");
      return `${expectEntitlements(after, "solo")}; period end ${after.current_period_end!.toISOString()}`;
    });

    let failedInvoice = "";
    await step("Failed renewal withholds paid features (past_due)", async () => {
      // pm_card_chargeCustomerFail attaches fine but every charge is declined.
      const failing = (await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", { customer: customerId })).id;
      await stripe.subscriptions.update(subscriptionId, { default_payment_method: failing });
      const end = await periodEnd(subscriptionId);
      await advanceClock(clockId!, end + 2 * 3600);
      const event = await deliverUntil("renewal payment failed", (e) => e.type === "invoice.payment_failed" && invoiceSubscriptionId(e.data.object as Stripe.Invoice) === subscriptionId);
      failedInvoice = (event.data.object as Stripe.Invoice).id!;
      await deliverUntil("subscription past_due", (e) => e.type === "customer.subscription.updated" && (e.data.object as Stripe.Subscription).status === "past_due", 30_000).catch(() => undefined);
      const state = await workspaceState(orgId);
      check(state.status === "past_due", `status is ${state.status}, expected past_due`);
      return expectEntitlements(state, "personal");
    });

    await step("Payment recovery restores Solo", async () => {
      await stripe.subscriptions.update(subscriptionId, { default_payment_method: visa });
      await stripe.invoices.pay(failedInvoice, { payment_method: visa });
      await deliverUntil("recovered invoice paid", (e) => e.type === "invoice.paid" && (e.data.object as Stripe.Invoice).id === failedInvoice);
      const state = await workspaceState(orgId);
      check(state.status === "active", `status is ${state.status}`);
      return expectEntitlements(state, "solo");
    });

    await step("Cancel at period end keeps Solo until then", async () => {
      await setOrganizerSubscriptionCancellation(stripe, { subscriptionId, organizationId: orgId, cancel: true });
      await deliverUntil("cancellation scheduled", (e) => e.type === "customer.subscription.updated" && Boolean((e.data.object as Stripe.Subscription).cancel_at_period_end));
      const state = await workspaceState(orgId);
      check(state.cancel_at_period_end === true, "cancel_at_period_end was not stored");
      return expectEntitlements(state, "solo");
    });

    await step("Resume clears the scheduled cancellation", async () => {
      await setOrganizerSubscriptionCancellation(stripe, { subscriptionId, organizationId: orgId, cancel: false });
      await deliverUntil("cancellation removed", (e) => e.type === "customer.subscription.updated" && !(e.data.object as Stripe.Subscription).cancel_at_period_end && (e.data.previous_attributes as Partial<Stripe.Subscription> | undefined)?.cancel_at_period_end === true);
      const state = await workspaceState(orgId);
      check(state.cancel_at_period_end === false, "cancel_at_period_end is still set");
      return expectEntitlements(state, "solo");
    });

    await step("Cancellation at period end drops to the free plan", async () => {
      await setOrganizerSubscriptionCancellation(stripe, { subscriptionId, organizationId: orgId, cancel: true });
      const end = await periodEnd(subscriptionId);
      await advanceClock(clockId!, end + 2 * 3600);
      const event = await deliverUntil("subscription deleted", (e) => e.type === "customer.subscription.deleted" && (e.data.object as Stripe.Subscription).id === subscriptionId);
      evidence.cancellationEvent = event.id;
      const state = await workspaceState(orgId);
      check(state.status === "canceled", `status is ${state.status}`);
      return expectEntitlements(state, "personal");
    });

    if (!skipPro) {
      let proSubscription = "";
      await step("Pro annual: checkout with 4242 grants pro_annual", async () => {
        const params = buildAnnualProCheckoutParams({ userId: ownerId, userEmail: null, priceId: prices.pro_annual, siteUrl });
        const result = await checkout(params, customerId, visa);
        proSubscription = result.subscriptionId;
        if (checkoutMode === "api") await deliver(result.event);
        await deliverUntil("Pro invoice paid", (e) => e.type === "invoice.paid" && invoiceSubscriptionId(e.data.object as Stripe.Invoice) === proSubscription);
        const row = await queryOne<{ tier: string; status: string }>("SELECT tier, status FROM user_subscriptions WHERE stripe_subscription_id = $1", [proSubscription]);
        check(row?.tier === "pro_annual" && row.status === "active", `user subscription is ${JSON.stringify(row)}`);
        return `${proSubscription}: pro_annual active`;
      });

      await step("Pro annual: cancellation returns the host to free", async () => {
        await stripe.subscriptions.cancel(proSubscription);
        await deliverUntil("Pro subscription deleted", (e) => e.type === "customer.subscription.deleted" && (e.data.object as Stripe.Subscription).id === proSubscription);
        const row = await queryOne<{ tier: string; status: string }>("SELECT tier, status FROM user_subscriptions WHERE stripe_subscription_id = $1", [proSubscription]);
        check(row?.tier === "free" && row.status === "canceled", `user subscription is ${JSON.stringify(row)}`);
        return "free, canceled";
      });
    }
  } catch (error) {
    if (!(error instanceof StepFailed)) {
      results.push({ name: "Unexpected error", ok: false, detail: error instanceof Error ? error.message : String(error) });
      console.error(error);
    }
  } finally {
    if (keep) {
      console.log(`\nKept for inspection: test clock ${clockId ?? "none"}, workspace ${organizationId ?? "none"}, host ${userId ?? "none"}.`);
    } else {
      // Deleting the test clock deletes its customer and subscriptions in Stripe.
      if (clockId) await stripe.testHelpers.testClocks.del(clockId).catch((error) => console.error(`Could not delete test clock ${clockId}:`, error.message));
      if (organizationId) await query("DELETE FROM organizations WHERE id = $1", [organizationId]).catch(() => undefined);
      if (userId) {
        await query("DELETE FROM user_subscriptions WHERE user_id = $1", [userId]).catch(() => undefined);
        // Checkout analytics would otherwise survive as anonymous rows and skew conversion counts.
        await query("DELETE FROM activation_events WHERE user_id = $1", [userId]).catch(() => undefined);
        await query("DELETE FROM admin_users WHERE id = $1", [userId]).catch(() => undefined);
      }
      if (delivered.size > 0) await query("DELETE FROM webhook_receipts WHERE provider = 'stripe' AND event_id = ANY($1)", [[...delivered]]).catch(() => undefined);
    }
    await getDb().end().catch(() => undefined);
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed.`);
  if (Object.keys(prices).length > 0) {
    console.log("\nTest price IDs (put these in the test environment):");
    for (const key of Object.keys(prices) as (keyof typeof CATALOG)[]) console.log(`  ${CATALOG[key].envVar}=${prices[key]}`);
  }
  if (Object.keys(evidence).length > 0) {
    console.log("\nEvidence IDs for docs/paid-beta-evidence-register.md:");
    for (const [label, id] of Object.entries(evidence)) console.log(`  ${label}: ${id}`);
  }
  process.exitCode = failed.length > 0 ? 1 : 0;
}

void main();
