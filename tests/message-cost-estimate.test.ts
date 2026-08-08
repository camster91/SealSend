import test from "node:test";
import assert from "node:assert/strict";
import { estimateDeliveryCost } from "../src/lib/messages/cost-estimate";

const recipients = [
  { email: "one@example.com", phone: null },
  { email: null, phone: "+14165550100" },
  { email: "both@example.com", phone: "+14165550101" },
];

test("counts and prices only the selected delivery channels", () => {
  assert.deepEqual(
    estimateDeliveryCost(recipients, ["email"], { emailMicros: "1500" }),
    { emailCount: 2, smsCount: 0, costConfigured: true, estimatedCostMicros: 3000 },
  );
});

test("requires a configured rate for every selected channel", () => {
  assert.deepEqual(
    estimateDeliveryCost(recipients, ["email", "sms"], { emailMicros: "1500" }),
    { emailCount: 2, smsCount: 2, costConfigured: false, estimatedCostMicros: null },
  );
});

test("accepts an explicit zero-cost rate", () => {
  assert.deepEqual(
    estimateDeliveryCost(recipients, ["sms"], { smsMicros: "0" }),
    { emailCount: 0, smsCount: 2, costConfigured: true, estimatedCostMicros: 0 },
  );
});
