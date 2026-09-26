import assert from "node:assert/strict";
import test from "node:test";

import {
  WEBHOOK_MAX_ATTEMPTS,
  canUseWebhooks,
  generateWebhookSecret,
  isPrivateAddress,
  nextWebhookAttemptAt,
  signWebhookPayload,
  verifyWebhookSignature,
  webhookInputSchema,
  webhookUrlProblem,
} from "../src/lib/webhooks";

test("webhooks are an organizer-plan feature", () => {
  assert.equal(canUseWebhooks("solo"), true);
  assert.equal(canUseWebhooks("agency"), true);
  assert.equal(canUseWebhooks("personal"), false);
  assert.equal(canUseWebhooks(null), false);
});

test("signatures verify, and tampering, wrong secrets and stale timestamps fail", () => {
  const secret = generateWebhookSecret();
  assert.match(secret, /^whsec_[A-Za-z0-9_-]{43}$/);
  const body = JSON.stringify({ id: "d1", type: "rsvp.submitted" });
  const now = 1_790_000_000;
  const header = signWebhookPayload(secret, body, now);
  assert.match(header, /^t=1790000000,v1=[0-9a-f]{64}$/);
  assert.equal(verifyWebhookSignature(secret, body, header, now), true);
  assert.equal(verifyWebhookSignature(secret, `${body} `, header, now), false);
  assert.equal(verifyWebhookSignature(generateWebhookSecret(), body, header, now), false);
  assert.equal(verifyWebhookSignature(secret, body, header, now + 301), false);
  assert.equal(verifyWebhookSignature(secret, body, "garbage", now), false);
});

test("retries back off and stop after the last attempt", () => {
  const start = new Date("2026-09-26T00:00:00Z");
  assert.equal(nextWebhookAttemptAt(1, start)?.toISOString(), "2026-09-26T00:01:00.000Z");
  assert.equal(nextWebhookAttemptAt(2, start)?.toISOString(), "2026-09-26T00:05:00.000Z");
  assert.equal(nextWebhookAttemptAt(WEBHOOK_MAX_ATTEMPTS - 1, start)?.toISOString(), "2026-09-26T12:00:00.000Z");
  assert.equal(nextWebhookAttemptAt(WEBHOOK_MAX_ATTEMPTS, start), null);
});

test("private, loopback and link-local addresses are refused", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isPrivateAddress(address), false, address);
  }
});

test("endpoint URLs must be public https", () => {
  assert.equal(webhookUrlProblem("https://hooks.example.com/catch/abc"), null);
  assert.equal(webhookUrlProblem("http://example.com/hook"), "Use an https:// URL");
  assert.equal(webhookUrlProblem("https://localhost/hook"), "The URL must be publicly reachable");
  assert.equal(webhookUrlProblem("https://127.0.0.1/hook"), "The URL must be publicly reachable");
  assert.equal(webhookUrlProblem("https://[::1]/hook"), "The URL must be publicly reachable");
  assert.equal(webhookUrlProblem("https://169.254.169.254/latest/meta-data"), "The URL must be publicly reachable");
  assert.equal(webhookUrlProblem("https://db.internal/hook"), "The URL must be publicly reachable");
  assert.equal(webhookUrlProblem("https://user:pass@example.com/hook"), "The URL can't include a username or password");
  assert.equal(webhookUrlProblem("https://example.com:8443/hook"), "Use the standard HTTPS port");
});

test("webhook input needs a URL and known event types", () => {
  assert.equal(webhookInputSchema.safeParse({ url: "https://example.com/h", events: [] }).success, false);
  assert.equal(webhookInputSchema.safeParse({ url: "https://example.com/h", events: ["guest.deleted"] }).success, false);
  assert.equal(webhookInputSchema.safeParse({ url: "https://example.com/h", events: ["rsvp.submitted"], secret: "x" }).success, false);
  assert.equal(webhookInputSchema.safeParse({ url: "https://example.com/h", events: ["rsvp.submitted", "client.approved"] }).success, true);
});

test("a trailing-dot localhost is refused", () => {
  assert.equal(webhookUrlProblem("https://localhost./hook"), "The URL must be publicly reachable");
});

test("delivery-time DNS lookup refuses names that resolve to private addresses", async () => {
  const { publicOnlyLookup } = await import("../src/lib/webhooks");
  const error = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
    publicOnlyLookup("localhost", { all: true }, (err) => resolve(err));
  });
  assert.equal(error?.code, "EBLOCKED");
});
