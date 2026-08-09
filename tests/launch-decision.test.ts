import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { evaluateLaunchEvidence, REQUIRED_GATE_IDS } from "../scripts/release/launch-decision.mjs";

test("current launch evidence fails closed with every external or human blocker listed", async () => {
  const manifest = JSON.parse(await readFile("config/launch-evidence.json", "utf8"));
  const result = evaluateLaunchEvidence(manifest);
  assert.equal(result.decision, "NO_GO");
  assert.equal(result.errors.length, 0);
  assert.equal(result.required, REQUIRED_GATE_IDS.length);
  assert.deepEqual(result.blockers.map((blocker) => blocker.id), [
    "stripe_test_lifecycle", "mailgun_delivery_lifecycle", "twilio_delivery_lifecycle", "operational_alerting",
    "provider_cost_approval", "retention_policy_approval", "five_host_beta", "real_device_accessibility",
    "privacy_terms_legal", "refund_cancellation_legal", "tax_accounting", "email_sms_compliance", "launch_metrics",
  ]);
});

test("launch evidence cannot pass without evidence and named human approval", () => {
  const gates: Array<{ id: string; kind: string; status: string; evidence?: string[] }> = REQUIRED_GATE_IDS.map((id) => ({ id, kind: "automated", status: "pass", evidence: ["verified"] }));
  const privacy = gates.find((gate) => gate.id === "privacy_terms_legal");
  assert.ok(privacy);
  privacy.kind = "human";
  delete privacy.evidence;
  const result = evaluateLaunchEvidence({ schemaVersion: 1, gates });
  assert.equal(result.decision, "NO_GO");
  assert.match(result.errors.join("\n"), /passing gate requires evidence/);
  assert.match(result.errors.join("\n"), /human approval requires/);
});
