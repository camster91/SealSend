import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_GATE_IDS = [
  "production_safety", "repository_quality", "load_capacity", "backup_restore", "rollback_image_restore",
  "stripe_test_lifecycle", "mailgun_delivery_lifecycle", "twilio_delivery_lifecycle", "operational_alerting",
  "provider_cost_approval", "retention_policy_approval", "five_host_beta", "real_device_accessibility",
  "privacy_terms_legal", "refund_cancellation_legal", "tax_accounting", "email_sms_compliance", "launch_metrics",
];

export function evaluateLaunchEvidence(manifest) {
  const errors = [];
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.gates)) errors.push("Unsupported or missing launch evidence schema");
  const gates = new Map();
  for (const gate of manifest?.gates || []) {
    if (!gate?.id || gates.has(gate.id)) { errors.push(`Missing or duplicate gate id: ${gate?.id || "unknown"}`); continue; }
    if (!["automated", "external", "human"].includes(gate.kind)) errors.push(`${gate.id}: invalid kind`);
    if (!["pass", "pending", "fail"].includes(gate.status)) errors.push(`${gate.id}: invalid status`);
    if (gate.status === "pass" && (!Array.isArray(gate.evidence) || !gate.evidence.length)) errors.push(`${gate.id}: passing gate requires evidence`);
    if (gate.status !== "pass" && !gate.blocker) errors.push(`${gate.id}: incomplete gate requires a blocker`);
    if (gate.status === "pass" && gate.kind === "human" && (!gate.approvedBy || !/^\d{4}-\d{2}-\d{2}$/.test(gate.approvalDate || ""))) {
      errors.push(`${gate.id}: human approval requires approvedBy and approvalDate`);
    }
    gates.set(gate.id, gate);
  }
  for (const id of REQUIRED_GATE_IDS) if (!gates.has(id)) errors.push(`Missing required gate: ${id}`);
  const blockers = REQUIRED_GATE_IDS
    .map((id) => gates.get(id))
    .filter((gate) => gate && gate.status !== "pass")
    .map((gate) => ({ id: gate.id, status: gate.status, blocker: gate.blocker }));
  return {
    decision: errors.length === 0 && blockers.length === 0 ? "GO_TO_STAGED_ACTIVATION" : "NO_GO",
    errors,
    blockers,
    passed: REQUIRED_GATE_IDS.length - blockers.length,
    required: REQUIRED_GATE_IDS.length,
  };
}

async function main() {
  const manifestPath = process.argv.find((argument) => argument.endsWith(".json")) || "config/launch-evidence.json";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = evaluateLaunchEvidence(manifest);
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
  else if (result.decision === "NO_GO" && !process.argv.includes("--allow-no-go")) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Launch decision failed");
    process.exitCode = 1;
  });
}
