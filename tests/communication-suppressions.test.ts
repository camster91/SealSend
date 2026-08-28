import assert from "node:assert/strict";
import test from "node:test";

import {
  communicationSuppressionKey,
  isCommunicationSuppressed,
  normalizeCommunicationRecipient,
} from "../src/lib/communication-suppressions";

test("email suppressions are case-insensitive and store only a hash key", () => {
  const first = communicationSuppressionKey("email", " Guest@Example.COM ");
  const second = communicationSuppressionKey("email", "guest@example.com");

  assert.equal(first, second);
  assert.match(first, /^email:[a-f0-9]{64}$/);
  assert.equal(first.includes("guest@example.com"), false);
});

test("SMS suppressions ignore presentation punctuation", () => {
  assert.equal(
    normalizeCommunicationRecipient("sms", "+1 (416) 555-0123"),
    "+14165550123",
  );
  assert.equal(
    communicationSuppressionKey("sms", "+1 (416) 555-0123"),
    communicationSuppressionKey("sms", "+14165550123"),
  );
});

test("suppression lookup stays channel-specific", () => {
  const suppressions = new Set([communicationSuppressionKey("email", "guest@example.com")]);

  assert.equal(isCommunicationSuppressed(suppressions, "email", "GUEST@example.com"), true);
  assert.equal(isCommunicationSuppressed(suppressions, "sms", "+14165550123"), false);
});
