import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { evaluateQualityScorecard } from "../scripts/release/quality-score.mjs";

const category = (id: string, maximum: number, earned: number) => ({
  id,
  maximum,
  earned,
  evidence: earned > 0 ? [`tests/${id}.test.ts`] : [],
  missingEvidence: earned < maximum ? [`Real evidence missing for ${id}`] : [],
});

const scorecard = {
  schemaVersion: 1,
  reviewedAt: "2026-08-28",
  dimensions: {
    productCapability: {
      target: 90,
      categories: [category("activation", 50, 40), category("operations", 50, 41)],
    },
    competitivePosition: {
      target: 85,
      categories: [category("positioning", 50, 35), category("proof", 50, 31)],
    },
  },
};

test("quality score preserves current evidence without treating partial work as complete", () => {
  const result = evaluateQualityScorecard(scorecard, { passed: 5, required: 18 });

  assert.deepEqual(result.scores, {
    productCapability: 81,
    competitivePosition: 66,
    paidLaunchReadiness: 27.8,
    weightedLaunchScore: 56,
  });
  assert.equal(result.targets.productCapability, false);
  assert.equal(result.targets.competitivePosition, false);
  assert.equal(result.targets.paidLaunchReadiness, false);
  assert.equal(result.decision, "KEEP_WORKING");
  assert.deepEqual(result.errors, []);
});

test("quality score refuses malformed or unsupported scoring", () => {
  const unsupported = structuredClone(scorecard);
  unsupported.dimensions.productCapability.categories[0].evidence = [];
  unsupported.dimensions.competitivePosition.categories[0].missingEvidence = [];

  const result = evaluateQualityScorecard(unsupported, { passed: 5, required: 18 });

  assert.match(result.errors.join("\n"), /activation: earned points require linked evidence/);
  assert.match(result.errors.join("\n"), /positioning: partial points require explicit missing evidence/);
});

test("quality score requires each dimension to allocate exactly 100 points", () => {
  const malformed = structuredClone(scorecard);
  malformed.dimensions.productCapability.categories[0].maximum = 49;

  const result = evaluateQualityScorecard(malformed, { passed: 18, required: 18 });

  assert.match(result.errors.join("\n"), /productCapability: category maximums must total 100/);
});

test("checked-in quality score stays evidence-bounded and agrees with launch gates", async () => {
  const checkedInScorecard = JSON.parse(await readFile("config/quality-scorecard.json", "utf8"));
  const launchEvidence = JSON.parse(await readFile("config/launch-evidence.json", "utf8"));
  const result = evaluateQualityScorecard(checkedInScorecard, {
    passed: launchEvidence.gates.filter((gate: { status: string }) => gate.status === "pass").length,
    required: launchEvidence.gates.length,
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.scores.productCapability, 82);
  assert.equal(result.scores.competitivePosition, 69);
  assert.equal(result.scores.paidLaunchReadiness, 38.9);
  assert.equal(result.decision, "KEEP_WORKING");
});
