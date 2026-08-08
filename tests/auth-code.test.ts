import test from "node:test";
import assert from "node:assert/strict";
import { hashAuthCode } from "../src/lib/auth/code-hash";

test("OTP hashes are deterministic, scoped, and do not expose the code", () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-only-secret-that-is-at-least-thirty-two-characters";
  try {
    const host = hashAuthCode({ code: "123456", recipient: "USER@example.com", role: "admin" });
    const normalized = hashAuthCode({ code: "123456", recipient: "user@example.com", role: "admin" });
    const guest = hashAuthCode({ code: "123456", recipient: "user@example.com", role: "guest", eventId: "event-a" });
    assert.equal(host, normalized);
    assert.notEqual(host, guest);
    assert.doesNotMatch(host, /123456/);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous;
  }
});
