import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import * as launchDecision from "../scripts/release/launch-decision.mjs";

const { evaluateLaunchEvidence, REQUIRED_GATE_IDS } = launchDecision;

test("current launch evidence fails closed with every external or human blocker listed", async () => {
  const manifest = JSON.parse(await readFile("config/launch-evidence.json", "utf8"));
  const result = evaluateLaunchEvidence(manifest);
  assert.equal(result.decision, "NO_GO");
  assert.equal(result.errors.length, 0);
  assert.equal(result.required, REQUIRED_GATE_IDS.length);
  assert.deepEqual(result.blockers.map((blocker) => blocker.id), [
    "stripe_test_lifecycle", "mailgun_delivery_lifecycle", "twilio_delivery_lifecycle", "operational_alerting",
    "five_host_beta", "real_device_accessibility",
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

test("required human and external gates cannot be reclassified as automated", () => {
  const gates = REQUIRED_GATE_IDS.map((id) => ({
    id,
    kind: "automated",
    status: "pass",
    evidence: ["verified"],
  }));

  const result = evaluateLaunchEvidence({ schemaVersion: 1, gates });

  assert.equal(result.decision, "NO_GO");
  assert.match(result.errors.join("\n"), /stripe_test_lifecycle: expected external gate/i);
  assert.match(result.errors.join("\n"), /privacy_terms_legal: expected human gate/i);
});

test("repository quality evidence is bound to the verified source digest", async () => {
  const manifest = JSON.parse(await readFile("config/launch-evidence.json", "utf8"));
  const repositoryGate = manifest.gates.find((gate: { id: string }) => gate.id === "repository_quality");
  assert.ok(repositoryGate);
  repositoryGate.verifiedSourceDigest = "a".repeat(64);

  const matching = evaluateLaunchEvidence(manifest, { sourceDigest: "a".repeat(64) });
  assert.doesNotMatch(matching.errors.join("\n"), /source digest/i);

  const stale = evaluateLaunchEvidence(manifest, { sourceDigest: "b".repeat(64) });
  assert.equal(stale.decision, "NO_GO");
  assert.match(stale.errors.join("\n"), /repository_quality: verified source digest does not match/i);
});

test("source digest excludes only the self-referential launch manifest", () => {
  assert.equal(typeof launchDecision.digestTrackedSources, "function");
  const first = launchDecision.digestTrackedSources([
    "100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tsrc/app.ts",
    "100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tconfig/launch-evidence.json",
  ]);
  const manifestOnlyChange = launchDecision.digestTrackedSources([
    "100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tsrc/app.ts",
    "100644 cccccccccccccccccccccccccccccccccccccccc 0\tconfig/launch-evidence.json",
  ]);
  const sourceChange = launchDecision.digestTrackedSources([
    "100644 dddddddddddddddddddddddddddddddddddddddd 0\tsrc/app.ts",
    "100644 cccccccccccccccccccccccccccccccccccccccc 0\tconfig/launch-evidence.json",
  ]);

  assert.equal(first, manifestOnlyChange);
  assert.notEqual(first, sourceChange);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("launch source digest refuses a dirty tracked worktree", async () => {
  assert.equal(typeof launchDecision.resolveCurrentSourceDigest, "function");
  await assert.rejects(
    () => launchDecision.resolveCurrentSourceDigest(async (args: string[]) => (
      args[0] === "status" ? " M src/app.ts\n" : ""
    )),
    /tracked worktree must be clean/i,
  );
});

test("current launch evaluation compares repository evidence with the tracked source tree", async () => {
  assert.equal(typeof launchDecision.evaluateCurrentLaunchEvidence, "function");
  const manifest = JSON.parse(await readFile("config/launch-evidence.json", "utf8"));
  const repositoryGate = manifest.gates.find((gate: { id: string }) => gate.id === "repository_quality");
  assert.ok(repositoryGate);
  repositoryGate.verifiedSourceDigest = "a".repeat(64);

  const result = await launchDecision.evaluateCurrentLaunchEvidence(manifest, async (args: string[]) => (
    args[0] === "status"
      ? ""
      : "100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tsrc/app.ts\n"
  ));

  assert.match(result.errors.join("\n"), /verified source digest does not match/i);
});
