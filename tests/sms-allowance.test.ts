import assert from "node:assert/strict";
import test from "node:test";

import { decideSmsSend, isSmsMetered, smsAllowanceMessage } from "../src/lib/sms-allowance";

test("only Event Pass events on free accounts are metered", () => {
  assert.equal(isSmsMetered("free", "event_pass"), true);
  assert.equal(isSmsMetered("free", "free"), false);
  assert.equal(isSmsMetered("free", "gold"), false);
  assert.equal(isSmsMetered("pro_annual", "event_pass"), false);
  assert.equal(isSmsMetered("beta", "event_pass"), false);
});

test("a metered send is allowed only when the balance covers every segment", () => {
  assert.deepEqual(decideSmsSend(true, 10, 10), { allowed: true });
  assert.deepEqual(decideSmsSend(true, 9, 10), { allowed: false, balance: 9, required: 10 });
  assert.deepEqual(decideSmsSend(true, -3, 1), { allowed: false, balance: 0, required: 1 });
  assert.deepEqual(decideSmsSend(false, 0, 10_000), { allowed: true });
});

test("the refusal explains the shortfall and how to fix it", () => {
  const message = smsAllowanceMessage({ allowed: false, balance: 4, required: 12 });
  assert.match(message, /needs 12 SMS segments/);
  assert.match(message, /has 4 left/);
  assert.match(message, /top-up/);
});
