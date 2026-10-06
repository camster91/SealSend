import test from "node:test";
import assert from "node:assert/strict";
import { assertApprovedRecipient, isApprovedRecipient } from "../src/lib/communications-safety";

test("controlled communications fail closed without an allowlist", () => {
  assert.throws(() => assertApprovedRecipient("person@example.com", { testOnly: "true", allowed: "" }), /not approved/);
});

test("controlled communications accept only exact normalized recipients", () => {
  const env = { testOnly: "true", allowed: " TEST@Example.com, +14165551234 " };
  assert.doesNotThrow(() => assertApprovedRecipient("test@example.com", env));
  assert.doesNotThrow(() => assertApprovedRecipient("+14165551234", env));
  assert.throws(() => assertApprovedRecipient("other@example.com", env), /not approved/);
});

test("the guard can be disabled only explicitly", () => {
  assert.doesNotThrow(() => assertApprovedRecipient("person@example.com", { testOnly: "false", allowed: "" }));
});

test("isApprovedRecipient answers the same question without throwing", () => {
  const env = { testOnly: "true", allowed: "Host@Example.com" };
  assert.equal(isApprovedRecipient("host@example.com", env), true);
  assert.equal(isApprovedRecipient("stranger@example.com", env), false);
  assert.equal(isApprovedRecipient("stranger@example.com", { testOnly: "true", allowed: "" }), false);
  assert.equal(isApprovedRecipient("stranger@example.com", { testOnly: "false", allowed: "" }), true);
  // Anything but an explicit "false" keeps the guard closed.
  assert.equal(isApprovedRecipient("stranger@example.com", { testOnly: undefined, allowed: "" }), false);
});
