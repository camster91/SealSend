import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import Stripe from "stripe";

// Every route below shares one in-memory SQLite database through src/lib/db/client.ts.
process.env.SQLITE_PATH = ":memory:";
process.env.STRIPE_SECRET_KEY = "sk_test_provider_webhooks";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_provider_webhooks";
process.env.MAILGUN_WEBHOOK_SIGNING_KEY = "mailgun-signing-key";
process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token";
process.env.TWILIO_WEBHOOK_URL = "https://sealsend.test/api/webhooks/twilio";
process.env.CRON_SECRET = "cron-secret";
delete process.env.PAYMENTS_TEST_ONLY;

const { exec, query, queryOne } = await import("../src/lib/db/client");
const stripeRoute = await import("../src/app/api/webhooks/stripe/route");
const mailgunRoute = await import("../src/app/api/webhooks/mailgun/route");
const twilioRoute = await import("../src/app/api/webhooks/twilio/route");
const deleteAccountsRoute = await import("../src/app/api/cron/delete-accounts/route");
const { communicationSuppressionKey } = await import("../src/lib/communication-suppressions");
await exec(readFileSync("src/lib/db/schema.sql", "utf8"));

type Post = (request: never) => Promise<Response>;
const post = (handler: unknown, request: Request) => (handler as Post)(request as never);

async function seedUser(email: string, name = email.split("@")[0]): Promise<string> {
  const row = await queryOne<{ id: string }>("INSERT INTO admin_users (email, password, name) VALUES ($1, 'x', $2) RETURNING id", [email, name]);
  return row!.id;
}

async function seedTeam(slug: string, members: [string, string][]): Promise<string> {
  const org = await queryOne<{ id: string }>("INSERT INTO organizations (name, slug, plan) VALUES ($1, $1, 'studio') RETURNING id", [slug]);
  for (const [index, [userId, role]] of members.entries()) {
    await query(
      "INSERT INTO organization_members (organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4)",
      [org!.id, userId, role, new Date(Date.UTC(2026, 0, 1 + index))],
    );
  }
  return org!.id;
}

async function seedEvent(userId: string, slug: string, organizationId?: string): Promise<string> {
  const row = await queryOne<{ id: string }>(
    "INSERT INTO events (user_id, title, slug, organization_id) VALUES ($1, $2, $2, $3) RETURNING id",
    [userId, slug, organizationId ?? null],
  );
  return row!.id;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
function stripeEvent(id: string, type: string, object: Record<string, unknown>): Request {
  const payload = JSON.stringify({ id, object: "event", type, livemode: false, data: { object } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  return new Request("https://sealsend.test/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": signature } });
}

test("Stripe organizer webhooks sync the plan only for the subscription the workspace holds", async () => {
  const owner = await seedUser("stripe-owner@example.com");
  const org = await seedTeam("stripe-team", [[owner, "owner"]]);
  await query("UPDATE organizations SET plan = 'personal' WHERE id = $1", [org]);
  const checkout = (eventId: string, subscription: string, plan: string) => stripeEvent(eventId, "checkout.session.completed", {
    object: "checkout.session", id: `cs_${eventId}`, mode: "subscription", payment_status: "paid", customer: "cus_1", subscription,
    metadata: { kind: "organizer_plan", organizationId: org, plan, userId: owner },
  });
  const plan = async () => (await queryOne<{ plan: string }>("SELECT plan FROM organizations WHERE id = $1", [org]))!.plan;

  assert.equal((await post(stripeRoute.POST, checkout("evt_1", "sub_1", "solo"))).status, 200);
  assert.equal(await plan(), "solo");
  // A second, different subscription can't replace an active one or change the plan.
  await post(stripeRoute.POST, checkout("evt_2", "sub_2", "agency"));
  assert.equal(await plan(), "solo");
  assert.equal((await queryOne<{ stripe_subscription_id: string }>("SELECT stripe_subscription_id FROM organization_subscriptions WHERE organization_id = $1", [org]))!.stripe_subscription_id, "sub_1");

  const invoice = (eventId: string, type: string) => stripeEvent(eventId, type, { object: "invoice", id: `in_${eventId}`, subscription: "sub_1" });
  await post(stripeRoute.POST, invoice("evt_3", "invoice.payment_failed"));
  assert.equal(await plan(), "personal");
  assert.equal((await queryOne<{ status: string }>("SELECT status FROM organization_subscriptions WHERE organization_id = $1", [org]))!.status, "past_due");
  await post(stripeRoute.POST, invoice("evt_4", "invoice.paid"));
  assert.equal(await plan(), "solo");

  // Replays are ignored.
  const replay = await post(stripeRoute.POST, invoice("evt_3", "invoice.payment_failed"));
  assert.deepEqual(await replay.json(), { received: true, duplicate: true });
  assert.equal(await plan(), "solo");
});

function mailgunEvent(id: string, event: Record<string, unknown>): Request {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const token = `token-${id}`;
  const signature = createHmac("sha256", process.env.MAILGUN_WEBHOOK_SIGNING_KEY!).update(timestamp + token).digest("hex");
  return new Request("https://sealsend.test/api/webhooks/mailgun", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature: { timestamp, token, signature }, "event-data": { id, ...event } }),
  });
}

test("Mailgun bounces update delivery state, suppress the recipient once, and ignore replays", async () => {
  const host = await seedUser("mailgun-host@example.com");
  const eventId = await seedEvent(host, "mailgun-party");
  await query(
    "INSERT INTO send_logs (event_id, send_type, status, recipient, provider_message_id) VALUES ($1, 'email', 'sent', 'Guest@Example.com', '<msg-1@mg.test>')",
    [eventId],
  );
  const bounce = { event: "failed", severity: "permanent", message: { headers: { "message-id": "msg-1@mg.test" } }, "delivery-status": { message: "mailbox does not exist" } };

  assert.deepEqual(await (await post(mailgunRoute.POST, mailgunEvent("mg-1", bounce))).json(), { received: true });
  const log = await queryOne<{ status: string; error_message: string }>("SELECT status, error_message FROM send_logs WHERE event_id = $1", [eventId]);
  assert.deepEqual(log, { status: "bounced", error_message: "mailbox does not exist" });
  const [, hash] = communicationSuppressionKey("email", "guest@example.com").split(":");
  const suppression = await queryOne<{ reason: string; source_event_id: string }>(
    "SELECT reason, source_event_id FROM communication_suppressions WHERE user_id = $1 AND recipient_hash = $2", [host, hash],
  );
  assert.deepEqual(suppression, { reason: "bounced", source_event_id: eventId });

  assert.deepEqual(await (await post(mailgunRoute.POST, mailgunEvent("mg-1", bounce))).json(), { received: true, duplicate: true });
});

function twilioCallback(params: Record<string, string>): Request {
  const signed = Object.keys(params).sort().reduce((acc, key) => acc + key + params[key], "");
  const signature = createHmac("sha1", process.env.TWILIO_AUTH_TOKEN!).update(process.env.TWILIO_WEBHOOK_URL! + signed).digest("base64");
  return new Request(process.env.TWILIO_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "x-twilio-signature": signature },
    body: new URLSearchParams(params).toString(),
  });
}

test("Twilio status callbacks merge send-log metadata, mark the phone invalid, and ignore replays", async () => {
  const host = await seedUser("twilio-host@example.com");
  const eventId = await seedEvent(host, "twilio-party");
  await query("INSERT INTO guests (event_id, name, phone) VALUES ($1, 'Guest', '+15550001111')", [eventId]);
  await query(
    "INSERT INTO send_logs (event_id, send_type, status, recipient, provider_message_id, metadata) VALUES ($1, 'sms', 'sent', '+15550001111', 'SM1', $2)",
    [eventId, { segments: 2 }],
  );
  const callback = { MessageSid: "SM1", MessageStatus: "undelivered", To: "+15550001111", From: "+15559998888", ErrorCode: "30003" };

  assert.equal((await post(twilioRoute.POST, twilioCallback(callback))).status, 200);
  const log = await queryOne<{ status: string; error_message: string; metadata: Record<string, unknown> }>(
    "SELECT status, error_message, metadata FROM send_logs WHERE provider_message_id = 'SM1'",
  );
  assert.equal(log!.status, "bounced");
  assert.equal(log!.error_message, "Unreachable destination handset");
  assert.equal(log!.metadata.segments, 2);
  assert.equal(log!.metadata.twilioStatus, "bounced");
  assert.equal(log!.metadata.errorCode, "30003");
  assert.ok((await queryOne<{ phone_invalid_at: Date | null }>("SELECT phone_invalid_at FROM guests WHERE event_id = $1", [eventId]))!.phone_invalid_at instanceof Date);

  const replay = await post(twilioRoute.POST, twilioCallback(callback));
  assert.deepEqual(await replay.json(), { received: true, duplicate: true });
});

test("account deletion hands over team workspaces, rehomes other hosts' events, and skips billed accounts", async () => {
  const leaver = await seedUser("leaver@example.com");
  const admin = await seedUser("admin@example.com");
  const planner = await seedUser("planner@example.com");
  const otherHost = await seedUser("other-host@example.com", "Other Host");
  const billed = await seedUser("billed@example.com");

  const handedOver = await seedTeam("handed-over", [[leaver, "owner"], [planner, "planner"], [admin, "admin"]]);
  const orphaned = await seedTeam("orphaned", [[leaver, "owner"], [otherHost, "check_in"]]);
  const leaverTeamEvent = await seedEvent(leaver, "leaver-team-event", handedOver);
  const leaverPersonalEvent = await seedEvent(leaver, "leaver-personal-event");
  const otherHostEvent = await seedEvent(otherHost, "other-host-event", orphaned);

  const due = new Date(Date.now() - 60_000);
  for (const userId of [leaver, billed]) {
    await query("INSERT INTO account_deletion_requests (user_id, scheduled_for) VALUES ($1, $2)", [userId, due]);
  }
  await query("INSERT INTO user_subscriptions (user_id, stripe_subscription_id, tier, status) VALUES ($1, 'sub_billed', 'pro_annual', 'active')", [billed]);

  const run = () => deleteAccountsRoute.GET(new Request("https://sealsend.test/api/cron/delete-accounts", {
    headers: { authorization: "Bearer cron-secret" },
  }) as never);
  const result = await (await run()).json();
  assert.equal(result.examined, 2);
  assert.equal(result.deleted, 1);
  assert.equal(result.blocked, 1);

  assert.equal(await queryOne("SELECT id FROM admin_users WHERE id = $1", [leaver]), null);
  assert.equal(await queryOne("SELECT id FROM events WHERE id = $1", [leaverPersonalEvent]), null);
  // The longest-serving admin (not the earlier planner) becomes owner and takes the leaver's team event.
  assert.equal((await queryOne<{ role: string }>("SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2", [handedOver, admin]))!.role, "owner");
  assert.equal((await queryOne<{ user_id: string }>("SELECT user_id FROM events WHERE id = $1", [leaverTeamEvent]))!.user_id, admin);
  // The workspace with nobody left is removed; the other host's event moves to their new personal workspace.
  assert.equal(await queryOne("SELECT id FROM organizations WHERE id = $1", [orphaned]), null);
  const rehomed = await queryOne<{ organization_id: string; is_personal: boolean; created_by: string }>(
    "SELECT e.organization_id, o.is_personal, o.created_by FROM events e JOIN organizations o ON o.id = e.organization_id WHERE e.id = $1", [otherHostEvent],
  );
  assert.deepEqual({ is_personal: rehomed!.is_personal, created_by: rehomed!.created_by }, { is_personal: true, created_by: otherHost });
  assert.equal((await queryOne<{ role: string }>("SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2", [rehomed!.organization_id, otherHost]))!.role, "owner");
  assert.ok(await queryOne("SELECT user_directory FROM deleted_account_upload_cleanup WHERE user_directory = $1", [leaver]) || result.uploadsDeleted === 1);

  // The billed account stays pending; a second run deletes nothing new.
  assert.ok(await queryOne("SELECT id FROM admin_users WHERE id = $1", [billed]));
  const again = await (await run()).json();
  assert.deepEqual({ examined: again.examined, deleted: again.deleted, blocked: again.blocked }, { examined: 1, deleted: 0, blocked: 1 });
});
