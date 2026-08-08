import test from "node:test";
import assert from "node:assert/strict";
import { assertApprovedRecipient } from "../src/lib/communications-safety";

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
