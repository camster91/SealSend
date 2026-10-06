import assert from "node:assert/strict";
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
  const token = createUnsubscribeToken(OWNER, "  Guest@Example.COM ");
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "token is URL-safe base64url");
  assert.deepEqual(verifyUnsubscribeToken(token), { ownerUserId: OWNER, email: "guest@example.com" });
});

test("the same owner and email always give the same token", () => {
  assert.equal(createUnsubscribeToken(OWNER, "a@b.co"), createUnsubscribeToken(OWNER, "A@B.CO"));
});

test("a tampered payload is rejected", () => {
  const token = createUnsubscribeToken(OWNER, "guest@example.com");
  const [, signature] = token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify([OWNER, "victim@example.com"])).toString("base64url");
  assert.equal(verifyUnsubscribeToken(`${forgedPayload}.${signature}`), null);
});

test("a tampered signature is rejected", () => {
  const token = createUnsubscribeToken(OWNER, "guest@example.com");
  const [payload, signature] = token.split(".");
  const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
  assert.equal(verifyUnsubscribeToken(`${payload}.${flipped}`), null);
  assert.equal(verifyUnsubscribeToken(`${payload}.${signature.slice(0, -2)}`), null, "truncated signature");
  assert.equal(verifyUnsubscribeToken(`${payload}.`), null);
});

test("a token for one email can't be reused for another", () => {
  const first = createUnsubscribeToken(OWNER, "one@example.com");
  const second = createUnsubscribeToken(OWNER, "two@example.com");
  const [firstPayload] = first.split(".");
  const [, secondSignature] = second.split(".");
  assert.equal(verifyUnsubscribeToken(`${firstPayload}.${secondSignature}`), null);
  assert.notEqual(first.split(".")[1], second.split(".")[1]);
});

test("a token for one host can't be reused for another host", () => {
  const token = createUnsubscribeToken(OWNER, "guest@example.com");
  const [, signature] = token.split(".");
  const otherOwner = Buffer.from(JSON.stringify(["99999999-1111-4222-8333-944455556666", "guest@example.com"])).toString("base64url");
  assert.equal(verifyUnsubscribeToken(`${otherOwner}.${signature}`), null);
});

test("garbage never throws and always returns null", () => {
  for (const garbage of ["", ".", "abc", "a.b.c", "!!!.???", "x".repeat(5000), "%00.%00", "e30.e30"]) {
    assert.equal(verifyUnsubscribeToken(garbage), null, `garbage: ${garbage.slice(0, 20)}`);
  }
  // Correctly signed but the wrong shape inside.
  assert.equal(verifyUnsubscribeToken(undefined as unknown as string), null);
});

test("a token signed with another secret is rejected", () => {
  let foreign = "";
  withEnv({ UNSUBSCRIBE_SECRET: "a-completely-different-secret-value-0000" }, () => {
    foreign = createUnsubscribeToken(OWNER, "guest@example.com");
  });
  assert.equal(verifyUnsubscribeToken(foreign), null);
});

test("SESSION_SECRET is the fallback when UNSUBSCRIBE_SECRET is not set", () => {
  withEnv({ UNSUBSCRIBE_SECRET: undefined, SESSION_SECRET: "session-secret-for-fallback-0123456789" }, () => {
    const token = createUnsubscribeToken(OWNER, "guest@example.com");
    assert.deepEqual(verifyUnsubscribeToken(token), { ownerUserId: OWNER, email: "guest@example.com" });
  });
});

test("a missing secret is a clear error when creating a token", () => {
  withEnv({ UNSUBSCRIBE_SECRET: undefined, SESSION_SECRET: undefined }, () => {
    assert.throws(() => createUnsubscribeToken(OWNER, "guest@example.com"), /UNSUBSCRIBE_SECRET or SESSION_SECRET/);
    assert.equal(verifyUnsubscribeToken("abc.def"), null, "verify still never throws");
  });
});

test("an empty owner or email can't be tokenized", () => {
  assert.throws(() => createUnsubscribeToken("", "guest@example.com"));
  assert.throws(() => createUnsubscribeToken(OWNER, "   "));
});

test("unsubscribe URLs point at the page and the one-click API", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://staging.sealsend.app" }, () => {
    const token = createUnsubscribeToken(OWNER, "guest@example.com");
    assert.equal(unsubscribeUrl(OWNER, "guest@example.com"), `https://staging.sealsend.app/unsubscribe/${token}`);
    assert.equal(unsubscribeApiUrl(OWNER, "guest@example.com"), `https://staging.sealsend.app/api/unsubscribe/${token}`);
  });
  withEnv({ NEXT_PUBLIC_SITE_URL: undefined }, () => {
    assert.match(unsubscribeUrl(OWNER, "guest@example.com"), /^https:\/\/sealsend\.app\/unsubscribe\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});

test("List-Unsubscribe headers use the API URL and RFC 8058 one-click", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://sealsend.app" }, () => {
    const headers = listUnsubscribeHeaders(OWNER, "guest@example.com");
    const token = createUnsubscribeToken(OWNER, "guest@example.com");
    assert.deepEqual(headers, {
      "List-Unsubscribe": `<https://sealsend.app/api/unsubscribe/${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});

type Call = { text: string; values?: unknown[] };
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
  const token = createUnsubscribeToken(OWNER, "Guest@Example.com");
  const result = await handleUnsubscribe(token, client);
  assert.deepEqual(result, { status: 200, body: { ok: true } });
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /INSERT INTO communication_suppressions/);
  assert.match(calls[0].text, /ON CONFLICT/);
  const [userId, channel, hash, reason] = calls[0].values as string[];
  assert.equal(userId, OWNER);
  assert.equal(channel, "email");
  assert.equal(`email:${hash}`, communicationSuppressionKey("email", "guest@example.com"));
  assert.equal(reason, "unsubscribed");
});

test("handleUnsubscribe is idempotent: a second click is still ok", async () => {
  const { calls, client } = fakeClient();
  const token = createUnsubscribeToken(OWNER, "guest@example.com");
  assert.deepEqual(await handleUnsubscribe(token, client), { status: 200, body: { ok: true } });
  assert.deepEqual(await handleUnsubscribe(token, client), { status: 200, body: { ok: true } });
  assert.equal(calls.length, 2);
});

test("handleUnsubscribe rejects a bad token with 400 and records nothing", async () => {
  const { calls, client } = fakeClient();
  const result = await handleUnsubscribe("not-a-token", client);
  assert.equal(result.status, 400);
  assert.equal((result.body as { ok: boolean }).ok, false);
  assert.equal(calls.length, 0);
});

test("handleUnsubscribe treats a deleted host account as already unsubscribed", async () => {
  const fkError = Object.assign(new Error("violates foreign key constraint"), { code: "23503" });
  const { client } = fakeClient(fkError);
  const token = createUnsubscribeToken(OWNER, "guest@example.com");
  assert.deepEqual(await handleUnsubscribe(token, client), { status: 200, body: { ok: true } });
});

test("handleUnsubscribe lets unexpected database errors surface", async () => {
  const { client } = fakeClient(new Error("connection refused"));
  const token = createUnsubscribeToken(OWNER, "guest@example.com");
  await assert.rejects(handleUnsubscribe(token, client), /connection refused/);
});
