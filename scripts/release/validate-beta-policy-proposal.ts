#!/usr/bin/env tsx

import { readFile } from "node:fs/promises";
import { validateBetaPolicyProposal } from "../../src/lib/beta-policy-proposal";

async function main() {
  const path = "config/beta-acceptance-policy.proposed.json";
  const input = JSON.parse(await readFile(path, "utf8"));
  const result = validateBetaPolicyProposal(input);

  if (!result.success) {
    console.error(JSON.stringify({ valid: false, errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      valid: true,
      cohortVersion: result.data.cohortVersion,
      ownerDecision: result.data.ownerDecision,
      activationStatus: "NOT_APPROVED",
      thresholds: result.data.thresholds,
    }, null, 2));
  }
}

void main();
