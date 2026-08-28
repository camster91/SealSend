import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SOURCE_DIGEST_EXCLUSIONS = new Set(["config/launch-evidence.json"]);

export function digestTrackedSources(indexEntries) {
  const included = indexEntries
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => {
      const path = entry.slice(entry.indexOf("\t") + 1).replaceAll("\\", "/");
      return !SOURCE_DIGEST_EXCLUSIONS.has(path);
    })
    .sort();
  return createHash("sha256").update(`${included.join("\n")}\n`).digest("hex");
}

export async function resolveCurrentSourceDigest(runGit) {
  const status = await runGit(["status", "--porcelain", "--untracked-files=no"]);
  if (status.trim()) throw new Error("Tracked worktree must be clean before evaluating launch evidence.");
  const index = await runGit(["ls-files", "-s", "--cached"]);
  return digestTrackedSources(index.split(/\r?\n/));
}

export async function evaluateCurrentLaunchEvidence(manifest, runGit) {
  const sourceDigest = await resolveCurrentSourceDigest(runGit);
  return evaluateLaunchEvidence(manifest, { sourceDigest });
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { encoding: "utf8" }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

export const REQUIRED_GATE_KINDS = {
  production_safety: "automated",
  repository_quality: "automated",
  load_capacity: "automated",
  backup_restore: "automated",
  rollback_image_restore: "automated",
  stripe_test_lifecycle: "external",
  mailgun_delivery_lifecycle: "external",
  twilio_delivery_lifecycle: "external",
  operational_alerting: "external",
  provider_cost_approval: "human",
  retention_policy_approval: "human",
  five_host_beta: "human",
  real_device_accessibility: "human",
  privacy_terms_legal: "human",
  refund_cancellation_legal: "human",
  tax_accounting: "human",
  email_sms_compliance: "human",
  launch_metrics: "human",
};

export const REQUIRED_GATE_IDS = Object.keys(REQUIRED_GATE_KINDS);

export function evaluateLaunchEvidence(manifest, context = {}) {
  const errors = [];
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.gates)) errors.push("Unsupported or missing launch evidence schema");
  const gates = new Map();
  for (const gate of manifest?.gates || []) {
    if (!gate?.id || gates.has(gate.id)) { errors.push(`Missing or duplicate gate id: ${gate?.id || "unknown"}`); continue; }
    if (!["automated", "external", "human"].includes(gate.kind)) errors.push(`${gate.id}: invalid kind`);
    const expectedKind = REQUIRED_GATE_KINDS[gate.id];
    if (expectedKind && gate.kind !== expectedKind) errors.push(`${gate.id}: expected ${expectedKind} gate`);
    if (!["pass", "pending", "fail"].includes(gate.status)) errors.push(`${gate.id}: invalid status`);
    if (gate.status === "pass" && (!Array.isArray(gate.evidence) || !gate.evidence.length)) errors.push(`${gate.id}: passing gate requires evidence`);
    if (gate.status !== "pass" && !gate.blocker) errors.push(`${gate.id}: incomplete gate requires a blocker`);
    if (gate.status === "pass" && gate.kind === "human" && (!gate.approvedBy || !/^\d{4}-\d{2}-\d{2}$/.test(gate.approvalDate || ""))) {
      errors.push(`${gate.id}: human approval requires approvedBy and approvalDate`);
    }
    if (gate.id === "repository_quality" && gate.status === "pass") {
      if (!/^[a-f0-9]{64}$/.test(gate.verifiedSourceDigest || "")) {
        errors.push("repository_quality: passing gate requires a verified source digest");
      } else if (context.sourceDigest && gate.verifiedSourceDigest !== context.sourceDigest) {
        errors.push("repository_quality: verified source digest does not match the current source tree");
      }
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
  const result = await evaluateCurrentLaunchEvidence(manifest, runGit);
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
