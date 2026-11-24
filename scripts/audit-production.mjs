/**
 * Production dependency audit for CI.
 *
 * Fails on any high or critical advisory except GHSA-fc5q-39xc-vjpf
 * (picomatch ReDoS, currently unpatched; it reaches the production
 * graph through vite). Remove that allowlist entry once picomatch
 * ships a patched release.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Remove GHSA-fc5q-39xc-vjpf once picomatch ships a patched release.
export const ALLOWED_PRODUCTION_ADVISORIES = Object.freeze([
  "GHSA-fc5q-39xc-vjpf",
]);

const HIGH_SEVERITIES = new Set(["high", "critical"]);

function normalizeAdvisoryId(value) {
  const match = String(value || "").match(/GHSA-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/i);
  return match ? match[0].toUpperCase() : null;
}

function rootHighAdvisories(vulnerabilities, name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const entry = vulnerabilities[name];
  if (!entry || typeof entry !== "object") return [];

  const advisories = [];
  for (const via of entry.via || []) {
    if (typeof via === "string") {
      advisories.push(...rootHighAdvisories(vulnerabilities, via, seen));
      continue;
    }
    if (!via || typeof via !== "object") continue;
    const severity = String(via.severity || entry.severity || "").toLowerCase();
    if (!HIGH_SEVERITIES.has(severity)) continue;
    const id = normalizeAdvisoryId(via.url) || normalizeAdvisoryId(via.source) || `source:${via.source ?? "unknown"}`;
    advisories.push({
      id,
      name: via.name || entry.name || name,
      severity,
      title: via.title || "",
      url: via.url || "",
    });
  }
  return advisories;
}

function uniqueAdvisories(advisories) {
  const seen = new Set();
  const unique = [];
  for (const advisory of advisories) {
    const key = `${advisory.id}:${advisory.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(advisory);
  }
  return unique;
}

export function evaluateProductionAudit(report, allowedIds = ALLOWED_PRODUCTION_ADVISORIES) {
  if (!report || typeof report !== "object" || report.error) {
    const message = report?.error?.summary || report?.error?.detail || "npm audit did not return a report";
    return {
      ok: false,
      allowed: [],
      blocking: [{ id: "audit-error", name: "npm-audit", severity: "critical", title: message, url: "" }],
    };
  }

  const allowed = new Set(
    [...allowedIds].map((id) => normalizeAdvisoryId(id) || String(id).toUpperCase()),
  );
  const vulnerabilities = report.vulnerabilities || {};
  const allowedFindings = [];
  const blockingFindings = [];

  for (const name of Object.keys(vulnerabilities)) {
    for (const advisory of uniqueAdvisories(rootHighAdvisories(vulnerabilities, name))) {
      const bucket = allowed.has(advisory.id) ? allowedFindings : blockingFindings;
      if (!bucket.some((item) => item.id === advisory.id && item.name === advisory.name)) {
        bucket.push(advisory);
      }
    }
  }

  return {
    ok: blockingFindings.length === 0,
    allowed: uniqueAdvisories(allowedFindings),
    blocking: uniqueAdvisories(blockingFindings),
  };
}

export function formatAuditResult(result) {
  const lines = [];
  if (result.allowed.length) {
    lines.push(
      "Allowing GHSA-fc5q-39xc-vjpf (picomatch ReDoS via vite). Remove this exception once picomatch ships a patched release.",
    );
    for (const advisory of result.allowed) {
      lines.push(`  allowed ${advisory.severity} ${advisory.id} ${advisory.name}${advisory.title ? ` — ${advisory.title}` : ""}`);
    }
  }
  if (result.blocking.length) {
    lines.push("High or critical production advisories are blocking:");
    for (const advisory of result.blocking) {
      lines.push(`  ${advisory.severity} ${advisory.id} ${advisory.name}${advisory.title ? ` — ${advisory.title}` : ""}${advisory.url ? ` ${advisory.url}` : ""}`);
    }
  } else {
    lines.push("No blocking high or critical production advisories.");
  }
  return lines.join("\n");
}

export function parseAuditStdout(stdout, status) {
  const text = String(stdout || "").trim();
  if (!text) {
    return {
      error: {
        summary: `npm audit produced no JSON (exit ${status})`,
      },
    };
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: {
        summary: `npm audit returned invalid JSON (exit ${status})`,
      },
    };
  }
}

function main() {
  const proc = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (proc.error) {
    console.error(`Failed to run npm audit: ${proc.error.message}`);
    process.exit(1);
  }

  const report = parseAuditStdout(proc.stdout, proc.status);
  const result = evaluateProductionAudit(report);
  console.log(formatAuditResult(result));
  if (!result.ok) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
