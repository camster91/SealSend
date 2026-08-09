import { performance } from "node:perf_hooks";

const target = new URL(process.env.LOAD_TARGET_URL || "https://sealsend.app");
const concurrency = Number.parseInt(process.env.LOAD_CONCURRENCY || "10", 10);
const requestCount = Number.parseInt(process.env.LOAD_REQUESTS || "200", 10);
const p95LimitMs = Number.parseInt(process.env.LOAD_P95_LIMIT_MS || "1500", 10);

if (target.protocol !== "https:" && process.env.ALLOW_INSECURE_LOAD_TARGET !== "true") {
  throw new Error("Load target must use HTTPS unless ALLOW_INSECURE_LOAD_TARGET=true");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) throw new Error("LOAD_CONCURRENCY must be between 1 and 50");
if (!Number.isInteger(requestCount) || requestCount < 1 || requestCount > 5000) throw new Error("LOAD_REQUESTS must be between 1 and 5000");
if (!Number.isInteger(p95LimitMs) || p95LimitMs < 100) throw new Error("LOAD_P95_LIMIT_MS must be at least 100");

const paths = ["/api/health", "/", "/pricing", "/how-it-works", "/privacy", "/terms", "/robots.txt"];
const timings = [];
const failures = [];
let nextIndex = 0;

async function worker() {
  while (true) {
    const index = nextIndex++;
    if (index >= requestCount) return;
    const path = paths[index % paths.length];
    const started = performance.now();
    try {
      const response = await fetch(new URL(path, target), {
        headers: { "User-Agent": "SealSend controlled load readiness/1.0" },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      const elapsed = performance.now() - started;
      timings.push(elapsed);
      await response.arrayBuffer();
      if (response.status !== 200) failures.push({ path, status: response.status });
      if (path === "/api/health" && response.headers.get("cache-control") !== "no-store") {
        failures.push({ path, error: "health response is cacheable" });
      }
    } catch (error) {
      timings.push(performance.now() - started);
      failures.push({ path, error: error instanceof Error ? error.name : "request failed" });
    }
  }
}

const suiteStarted = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
timings.sort((a, b) => a - b);
const percentile = (fraction) => timings[Math.min(timings.length - 1, Math.ceil(timings.length * fraction) - 1)] ?? 0;
const summary = {
  target: target.origin,
  requests: requestCount,
  concurrency,
  failures: failures.length,
  durationMs: Math.round(performance.now() - suiteStarted),
  latencyMs: { p50: Math.round(percentile(0.5)), p95: Math.round(percentile(0.95)), max: Math.round(timings.at(-1) ?? 0) },
  thresholds: { failures: 0, p95Ms: p95LimitMs },
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 20), null, 2));
  process.exitCode = 1;
} else if (summary.latencyMs.p95 > p95LimitMs) {
  console.error(`p95 latency ${summary.latencyMs.p95}ms exceeds ${p95LimitMs}ms`);
  process.exitCode = 1;
}
