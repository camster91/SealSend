import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  createUnsubscribeToken,
  handleUnsubscribe,
  listUnsubscribeHeaders,
  unsubscribeApiUrl,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from "../src/lib/unsubscribe";
import { communicationSuppressionKey } from "../src/lib/communication-suppressions";

const OWNER = "8a6b2c1e-1111-4222-8333-944455556666";
const EVENT = "e0e0e0e0-2222-4333-8444-955566667777";
const SECRET = "test-unsubscribe-secret-that-is-long-enough-123";

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

process.env.UNSUBSCRIBE_SECRET = SECRET;

test("an unsubscribe token round-trips the owner and the normalized email", () => {
  const token = createUnsubscribeToken(OWNER, "  Guest@Example.COM ", EVENT);
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "token is URL-safe base64url");
  assert.deepEqual(verifyUnsubscribeToken(token), { ownerUserId: OWNER, email: "guest@example.com", eventId: EVENT });
});

test("the same owner and email always give the same token", () => {
  assert.equal(createUnsubscribeToken(OWNER, "a@b.co", EVENT), createUnsubscribeToken(OWNER, "A@B.CO", EVENT));
});

test("a tampered payload is rejected", () => {
  const token = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
  const [, signature] = token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify([OWNER, "victim@example.com", EVENT])).toString("base64url");
  assert.equal(verifyUnsubscribeToken(`${forgedPayload}.${signature}`), null);
});

test("a tampered signature is rejected", () => {
  const token = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
  const [payload, signature] = token.split(".");
  const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
  assert.equal(verifyUnsubscribeToken(`${payload}.${flipped}`), null);
  assert.equal(verifyUnsubscribeToken(`${payload}.${signature.slice(0, -2)}`), null, "truncated signature");
  assert.equal(verifyUnsubscribeToken(`${payload}.`), null);
});

test("a token for one email can't be reused for another", () => {
  const first = createUnsubscribeToken(OWNER, "one@example.com", EVENT);
  const second = createUnsubscribeToken(OWNER, "two@example.com", EVENT);
  const [firstPayload] = first.split(".");
  const [, secondSignature] = second.split(".");
  assert.equal(verifyUnsubscribeToken(`${firstPayload}.${secondSignature}`), null);
  assert.notEqual(first.split(".")[1], second.split(".")[1]);
});

test("a token for one host can't be reused for another host", () => {
  const token = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
  const [, signature] = token.split(".");
  const otherOwner = Buffer.from(JSON.stringify(["99999999-1111-4222-8333-944455556666", "guest@example.com", EVENT])).toString("base64url");
  assert.equal(verifyUnsubscribeToken(`${otherOwner}.${signature}`), null);
});

test("garbage never throws and always returns null", () => {
  for (const garbage of ["", ".", "abc", "a.b.c", "!!!.???", "x".repeat(5000), "%00.%00", "e30.e30"]) {
    assert.equal(verifyUnsubscribeToken(garbage), null, `garbage: ${garbage.slice(0, 20)}`);
  }
  assert.equal(verifyUnsubscribeToken(undefined as unknown as string), null);
});

/** Signs any payload exactly as the server does, to test what a valid signature over a bad payload yields. */
function signRaw(value: unknown): string {
  const payload = Buffer.from(typeof value === "string" ? value : JSON.stringify(value), "utf8").toString("base64url");
  const signature = createHmac("sha256", SECRET).update("sealsend:unsubscribe:v1:" + payload).digest("base64url");
  return `${payload}.${signature}`;
}

test("a correctly signed payload of the wrong shape is rejected", () => {
  assert.deepEqual(verifyUnsubscribeToken(signRaw([OWNER, "guest@example.com", EVENT])), { ownerUserId: OWNER, email: "guest@example.com", eventId: EVENT }, "the signing helper matches the server");
  const wrongShapes: unknown[] = [
    [OWNER, "guest@example.com"], // the 2-field format from before the event id was added
    [OWNER, "guest@example.com", EVENT, "extra"],
    { ownerUserId: OWNER, email: "guest@example.com", eventId: EVENT },
    [OWNER, 42, EVENT],
    [OWNER, "guest@example.com", null],
    ["", "guest@example.com", EVENT],
    [OWNER, "", EVENT],
    [OWNER, "guest@example.com", ""],
    "not json",
    null,
    "just a string",
  ];
  for (const shape of wrongShapes) {
    assert.equal(verifyUnsubscribeToken(signRaw(shape)), null, `shape: ${JSON.stringify(shape)}`);
  }
});

test("a token signed with another secret is rejected", () => {
  let foreign = "";
  withEnv({ UNSUBSCRIBE_SECRET: "a-completely-different-secret-value-0000" }, () => {
    foreign = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
  });
  assert.equal(verifyUnsubscribeToken(foreign), null);
});

test("SESSION_SECRET is the fallback when UNSUBSCRIBE_SECRET is not set", () => {
  withEnv({ UNSUBSCRIBE_SECRET: undefined, SESSION_SECRET: "session-secret-for-fallback-0123456789" }, () => {
    const token = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
    assert.deepEqual(verifyUnsubscribeToken(token), { ownerUserId: OWNER, email: "guest@example.com", eventId: EVENT });
  });
});

test("a missing secret is a clear error when creating a token", () => {
  withEnv({ UNSUBSCRIBE_SECRET: undefined, SESSION_SECRET: undefined }, () => {
    assert.throws(() => createUnsubscribeToken(OWNER, "guest@example.com", EVENT), /UNSUBSCRIBE_SECRET or SESSION_SECRET/);
    assert.equal(verifyUnsubscribeToken("abc.def"), null, "verify still never throws");
  });
});

test("an empty owner, email or event can't be tokenized", () => {
  assert.throws(() => createUnsubscribeToken("", "guest@example.com", EVENT));
  assert.throws(() => createUnsubscribeToken(OWNER, "   ", EVENT));
  assert.throws(() => createUnsubscribeToken(OWNER, "guest@example.com", ""));
});

test("unsubscribe URLs point at the page and the one-click API", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://staging.sealsend.app" }, () => {
    const token = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
    assert.equal(unsubscribeUrl(OWNER, "guest@example.com", EVENT), `https://staging.sealsend.app/unsubscribe/${token}`);
    assert.equal(unsubscribeApiUrl(OWNER, "guest@example.com", EVENT), `https://staging.sealsend.app/api/unsubscribe/${token}`);
  });
  withEnv({ NEXT_PUBLIC_SITE_URL: undefined }, () => {
    assert.match(unsubscribeUrl(OWNER, "guest@example.com", EVENT), /^https:\/\/sealsend\.app\/unsubscribe\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});

test("List-Unsubscribe headers use the API URL and RFC 8058 one-click", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://sealsend.app" }, () => {
    const headers = listUnsubscribeHeaders(OWNER, "guest@example.com", EVENT);
    const token = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
    assert.deepEqual(headers, {
      "List-Unsubscribe": `<https://sealsend.app/api/unsubscribe/${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});

type Call = { text: string; values?: unknown[] };
const allowInvalid = async () => true;
function fakeClient(error?: Error & { code?: string }) {
  const calls: Call[] = [];
  return {
    calls,
    client: {
      async query<T>(text: string, values?: unknown[]) {
        calls.push({ text, values });
        if (error) throw error;
        return { rows: [] as T[] };
      },
    },
  };
}

test("handleUnsubscribe records an 'unsubscribed' email suppression for that host only", async () => {
  const { calls, client } = fakeClient();
  const token = createUnsubscribeToken(OWNER, "Guest@Example.com", EVENT);
  const result = await handleUnsubscribe(token, client, allowInvalid);
  assert.deepEqual(result, { status: 200, body: { ok: true } });
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /INSERT INTO communication_suppressions/);
  assert.ok(calls[0].text.includes("ON CONFLICT (user_id, channel, recipient_hash) DO NOTHING"), calls[0].text);
  assert.ok(!calls[0].text.includes("EXCLUDED.reason"), "a bounce or complaint already on file is kept");
  const [userId, channel, hash, reason] = calls[0].values as string[];
  assert.equal(userId, OWNER);
  assert.equal(channel, "email");
  assert.equal(`email:${hash}`, communicationSuppressionKey("email", "guest@example.com"));
  assert.equal(reason, "unsubscribed");
});

test("handleUnsubscribe is idempotent: a second click is still ok", async () => {
  const { calls, client } = fakeClient();
  const token = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
  assert.deepEqual(await handleUnsubscribe(token, client, allowInvalid), { status: 200, body: { ok: true } });
  assert.deepEqual(await handleUnsubscribe(token, client, allowInvalid), { status: 200, body: { ok: true } });
  assert.equal(calls.length, 2);
});

test("handleUnsubscribe rejects a bad token with 400 and records nothing", async () => {
  const { calls, client } = fakeClient();
  const result = await handleUnsubscribe("not-a-token", client, allowInvalid);
  assert.equal(result.status, 400);
  assert.equal((result.body as { ok: boolean }).ok, false);
  assert.equal(calls.length, 0);
});

test("handleUnsubscribe treats a deleted host account as already unsubscribed", async () => {
  const fkError = Object.assign(new Error("violates foreign key constraint"), { code: "23503" });
  const { client } = fakeClient(fkError);
  const token = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
  assert.deepEqual(await handleUnsubscribe(token, client, allowInvalid), { status: 200, body: { ok: true } });
});

test("handleUnsubscribe lets unexpected database errors surface", async () => {
  const { client } = fakeClient(new Error("connection refused"));
  const token = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
  await assert.rejects(handleUnsubscribe(token, client, allowInvalid), /connection refused/);
});

test("Important: a valid token is never rate-limited, however many times it is used", async () => {
  const { calls, client } = fakeClient();
  let limiterCalls = 0;
  const neverAllow = async () => { limiterCalls++; return false; };
  const token = createUnsubscribeToken(OWNER, "guest@example.com", EVENT);
  for (let i = 0; i < 50; i++) {
    assert.deepEqual(await handleUnsubscribe(token, client, neverAllow), { status: 200, body: { ok: true } });
  }
  assert.equal(limiterCalls, 0, "the limiter is only consulted for invalid tokens");
  assert.equal(calls.length, 50);
});

test("invalid tokens are rate-limited: 400 while allowed, 429 once the limit is hit", async () => {
  const { calls, client } = fakeClient();
  let remaining = 2;
  const limiter = async () => remaining-- > 0;
  assert.equal((await handleUnsubscribe("bad", client, limiter)).status, 400);
  assert.equal((await handleUnsubscribe("bad", client, limiter)).status, 400);
  const limited = await handleUnsubscribe("bad", client, limiter);
  assert.equal(limited.status, 429);
  assert.equal(calls.length, 0, "nothing is recorded for a bad token");
});

test("the route verifies before it rate-limits, and limits only invalid tokens per IP", async () => {
  const { readFile } = await import("node:fs/promises");
  const route = await readFile("src/app/api/unsubscribe/[token]/route.ts", "utf8");
  assert.ok(route.includes("handleUnsubscribe(token, getDb(), async () =>"), "the limiter is a callback for invalid tokens");
  assert.ok(route.includes("rateLimit(`unsubscribe-invalid:${getClientIp(request)}`"), "invalid tokens are limited per IP");
  assert.ok(route.indexOf("rateLimit(") > route.indexOf("handleUnsubscribe("), "rateLimit only runs inside the invalid-token callback");
});
