import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DIMENSIONS = ["productCapability", "competitivePosition"];

const rounded = (value) => Math.round(value * 10) / 10;

export function evaluateQualityScorecard(scorecard, launch) {
  const errors = [];
  const scores = {};

  if (scorecard?.schemaVersion !== 1) errors.push("Unsupported or missing quality scorecard schema");
  for (const dimensionId of DIMENSIONS) {
    const dimension = scorecard?.dimensions?.[dimensionId];
    if (!dimension || !Array.isArray(dimension.categories)) {
      errors.push(`${dimensionId}: categories are required`);
      scores[dimensionId] = 0;
      continue;
    }
    if (!Number.isFinite(dimension.target) || dimension.target < 0 || dimension.target > 100) {
      errors.push(`${dimensionId}: target must be between 0 and 100`);
    }
    const ids = new Set();
    let maximum = 0;
    let earned = 0;
    for (const category of dimension.categories) {
      const label = category?.id || `${dimensionId} category`;
      if (!category?.id || ids.has(category.id)) errors.push(`${dimensionId}: category ids must be present and unique`);
      ids.add(category?.id);
      if (!Number.isFinite(category?.maximum) || category.maximum <= 0) errors.push(`${label}: maximum must be positive`);
      if (!Number.isFinite(category?.earned) || category.earned < 0 || category.earned > category.maximum) {
        errors.push(`${label}: earned points must be between zero and the category maximum`);
      }
      const evidence = Array.isArray(category?.evidence) ? category.evidence.filter(Boolean) : [];
      const missingEvidence = Array.isArray(category?.missingEvidence) ? category.missingEvidence.filter(Boolean) : [];
      if (category?.earned > 0 && evidence.length === 0) errors.push(`${label}: earned points require linked evidence`);
      if (category?.earned < category?.maximum && missingEvidence.length === 0) {
        errors.push(`${label}: partial points require explicit missing evidence`);
      }
      maximum += Number.isFinite(category?.maximum) ? category.maximum : 0;
      earned += Number.isFinite(category?.earned) ? category.earned : 0;
    }
    if (maximum !== 100) errors.push(`${dimensionId}: category maximums must total 100`);
    scores[dimensionId] = rounded(earned);
  }

  const passed = Number.isInteger(launch?.passed) ? launch.passed : 0;
  const required = Number.isInteger(launch?.required) && launch.required > 0 ? launch.required : 0;
  if (passed < 0 || required === 0 || passed > required) errors.push("Paid launch gate counts are invalid");
  scores.paidLaunchReadiness = required ? rounded((passed / required) * 100) : 0;
  scores.weightedLaunchScore = rounded(
    (scores.productCapability || 0) * 0.35
      + (scores.competitivePosition || 0) * 0.25
      + scores.paidLaunchReadiness * 0.4,
  );

  const targets = {
    productCapability: scores.productCapability >= (scorecard?.dimensions?.productCapability?.target ?? 101),
    competitivePosition: scores.competitivePosition >= (scorecard?.dimensions?.competitivePosition?.target ?? 101),
    paidLaunchReadiness: passed === required && required > 0,
  };
  return {
    reviewedAt: scorecard?.reviewedAt || null,
    scores,
    targets,
    decision: errors.length === 0 && Object.values(targets).every(Boolean) ? "QUALITY_TARGETS_MET" : "KEEP_WORKING",
    errors,
  };
}

async function main() {
  const scorecard = JSON.parse(await readFile("config/quality-scorecard.json", "utf8"));
  const launchEvidence = JSON.parse(await readFile("config/launch-evidence.json", "utf8"));
  const required = launchEvidence.gates.length;
  const passed = launchEvidence.gates.filter((gate) => gate.status === "pass").length;
  const result = evaluateQualityScorecard(scorecard, { passed, required });
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
