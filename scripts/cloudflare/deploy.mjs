#!/usr/bin/env node
// Deploys the prebuilt Worker in .cloudflare/output with Wrangler.
//
// `npm run build:vinext` writes the Worker bundle, static assets and the resolved
// config (from cloudflare.config.ts) to .cloudflare/output/v0/workers/default.
// This turns that config into a wrangler.json and runs `wrangler deploy` without
// re-bundling. Used by Workers Builds as the deploy command:
//
//   npm ci && npm run build:vinext      (build)
//   node scripts/cloudflare/deploy.mjs  (deploy)
//
// Secrets are not touched: they stay as set on the Worker.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(root, ".cloudflare/output/v0/workers/default");
const configPath = path.join(out, "worker.config.json");
if (!existsSync(configPath)) {
  console.error("No build output found. Run `npm run build:vinext` first.");
  process.exit(1);
}

const built = JSON.parse(readFileSync(configPath, "utf8"));
const env = built.env ?? {};

const wrangler = {
  name: built.name,
  main: path.join(out, "bundle", built.manifest?.mainModule ?? "index.js"),
  compatibility_date: built.compatibilityDate,
  compatibility_flags: built.compatibilityFlags ?? [],
  no_bundle: true,
  rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"], fallthrough: true }],
  workers_dev: true,
  observability: { enabled: true },
  triggers: { crons: (built.triggers ?? []).filter((t) => t.type === "scheduled").map((t) => t.schedule) },
  vars: {},
  d1_databases: [],
  r2_buckets: [],
  send_email: [],
};

const assets = built.assets ?? {};
const htmlHandling = { none: "none", autoTrailingSlash: "auto-trailing-slash", forceTrailingSlash: "force-trailing-slash", dropTrailingSlash: "drop-trailing-slash" };
const notFound = { none: "none", singlePageApplication: "single-page-application", "404Page": "404-page" };

for (const [name, binding] of Object.entries(env)) {
  switch (binding.type) {
    case "assets":
      wrangler.assets = {
        directory: path.join(out, "assets"),
        binding: name,
        html_handling: htmlHandling[assets.htmlHandling] ?? assets.htmlHandling ?? "none",
        not_found_handling: notFound[assets.notFoundHandling] ?? assets.notFoundHandling ?? "none",
        ...(assets.runWorkerFirst ? { run_worker_first: assets.runWorkerFirst } : {}),
      };
      break;
    case "r2":
      wrangler.r2_buckets.push({ binding: name, bucket_name: binding.name });
      break;
    case "d1":
      wrangler.d1_databases.push({ binding: name, database_name: binding.name, database_id: binding.id });
      break;
    case "images":
      wrangler.images = { binding: name };
      break;
    case "send-email":
      wrangler.send_email.push({ name, ...(binding.allowedSenderAddresses ? { allowed_sender_addresses: binding.allowedSenderAddresses } : {}) });
      break;
    case "text":
      wrangler.vars[name] = binding.value;
      break;
    case "secret":
      break; // set on the Worker, kept across deploys
    default:
      console.error(`Unsupported binding type "${binding.type}" for ${name}; add it to scripts/cloudflare/deploy.mjs.`);
      process.exit(1);
  }
}

const target = path.join(root, ".cloudflare/wrangler.deploy.json");
writeFileSync(target, JSON.stringify(wrangler, null, 2));
console.log(`Wrote ${path.relative(root, target)}`);

const extra = process.argv.slice(2);
execFileSync("npx", ["--yes", "wrangler@4", "deploy", "--config", target, ...extra], { stdio: "inherit", cwd: root });
