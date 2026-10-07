import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectImageType, runCoverTurn } from "../src/lib/ai/cover-turn";
import { remainingQuota } from "../src/lib/rate-limit";
import type { CoverImageProvider } from "../src/lib/ai/image-provider";

const input = { title: "Secret Gala", description: "hush hush", style: "elegant" as const, note: "purple unicorns" };
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function provider(fn: CoverImageProvider["generate"]): CoverImageProvider & { calls: number } {
  const p = { calls: 0, generate: (i: Parameters<CoverImageProvider["generate"]>[0]) => { p.calls += 1; return fn(i); } };
  return p;
}
const allow = async () => ({ success: true, remaining: 2 });
const saveOk = async () => ({ url: "/uploads/x.webp" });

test("happy path saves and returns url + remaining", async () => {
  const p = provider(async () => ({ bytes: png }));
  const r = await runCoverTurn({ provider: p, consume: allow, save: saveOk, timeoutMs: 1000 }, input);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { url: "/uploads/x.webp", remaining: 2 });
});

test("4th request refused without calling the provider", async () => {
  const p = provider(async () => ({ bytes: png }));
  const r = await runCoverTurn({ provider: p, consume: async () => ({ success: false, remaining: 0 }), save: saveOk, timeoutMs: 1000 }, input);
  assert.equal(r.status, 429);
  assert.equal((r.json as { code: string }).code, "AI_COVER_LIMIT");
  assert.equal((r.json as { error: string }).error, "You've used today's 3 AI covers. Upload your own, or try again tomorrow.");
  assert.equal(p.calls, 0);
});

test("refused prompt -> 422 AI_REFUSED", async () => {
  const p = provider(async () => ({ refused: true as const }));
  const r = await runCoverTurn({ provider: p, consume: allow, save: saveOk, timeoutMs: 1000 }, input);
  assert.equal(r.status, 422);
  assert.equal((r.json as { code: string }).code, "AI_REFUSED");
  assert.equal((r.json as { error: string }).error, "That description can't be used for a cover. Try different words.");
});

test("provider throw -> 502 AI_FAILED", async () => {
  const p = provider(async () => { throw new Error("boom purple unicorns"); });
  const r = await runCoverTurn({ provider: p, consume: allow, save: saveOk, timeoutMs: 1000 }, input);
  assert.equal(r.status, 502);
  assert.equal((r.json as { code: string }).code, "AI_FAILED");
});

test("timeout -> 502 AI_FAILED", async () => {
  const p = provider(({ signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")));
  }));
  const r = await runCoverTurn({ provider: p, consume: allow, save: saveOk, timeoutMs: 20 }, input);
  assert.equal(r.status, 502);
  assert.equal((r.json as { code: string }).code, "AI_FAILED");
  assert.equal((r.json as { error: string }).error, "We couldn't make a cover right now. Try again, or upload your own.");
});

test("storage full -> 413 with upload copy", async () => {
  const p = provider(async () => ({ bytes: png }));
  const r = await runCoverTurn({ provider: p, consume: allow, save: async () => ({ error: "quota" as const }), timeoutMs: 1000 }, input);
  assert.equal(r.status, 413);
  assert.equal((r.json as { error: string }).error, "Your upload space is full.");
});

test("failures after the quota is spent carry remaining", async () => {
  const ok = provider(async () => ({ bytes: png }));
  const cases = [
    await runCoverTurn({ provider: provider(async () => { throw new Error("x"); }), consume: allow, save: saveOk, timeoutMs: 1000 }, input),
    await runCoverTurn({ provider: provider(async () => ({ refused: true as const })), consume: allow, save: saveOk, timeoutMs: 1000 }, input),
    await runCoverTurn({ provider: ok, consume: allow, save: async () => ({ error: "quota" as const }), timeoutMs: 1000 }, input),
    await runCoverTurn({ provider: ok, consume: allow, save: async () => ({ error: "invalid" as const }), timeoutMs: 1000 }, input),
  ];
  for (const r of cases) assert.equal((r.json as { remaining: number }).remaining, 2);
});

test("detectImageType reads PNG, JPEG and WebP, and nothing else", () => {
  assert.equal(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0])), "image/png");
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(detectImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBP")])), "image/webp");
  assert.equal(detectImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WAVE")])), null);
  assert.equal(detectImageType(Buffer.from("GIF89a")), null);
  assert.equal(detectImageType(Buffer.alloc(0)), null);
});

test("the detected type is passed to save; unknown bytes -> 502 without saving", async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  let seen = "";
  const r = await runCoverTurn({ provider: provider(async () => ({ bytes: jpeg })), consume: allow, save: async (_b, t) => { seen = t; return { url: "/u.jpg" }; }, timeoutMs: 1000 }, input);
  assert.equal(r.status, 200);
  assert.equal(seen, "image/jpeg");
  let saved = false;
  const bad = await runCoverTurn({ provider: provider(async () => ({ bytes: Buffer.from("not an image") })), consume: allow, save: async () => { saved = true; return { url: "/u" }; }, timeoutMs: 1000 }, input);
  assert.equal(bad.status, 502);
  assert.equal((bad.json as { code: string }).code, "AI_FAILED");
  assert.equal(saved, false);
});

test("a client disconnect aborts the provider call", async () => {
  const gone = new AbortController();
  const p = provider(({ signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")));
  }));
  const pending = runCoverTurn({ provider: p, consume: allow, save: saveOk, timeoutMs: 10_000, signal: gone.signal }, input);
  setTimeout(() => gone.abort(), 10);
  const r = await pending;
  assert.equal(r.status, 502);
});

test("route passes the request signal and the detected type", () => {
  const route = readFileSync("src/app/api/ai/cover/route.ts", "utf8");
  assert.ok(route.includes("signal: request.signal"));
  assert.ok(!route.includes('contentType: "image/png"'));
});

test("invalid image -> 502 AI_FAILED", async () => {
  const p = provider(async () => ({ bytes: png }));
  const r = await runCoverTurn({ provider: p, consume: allow, save: async () => ({ error: "invalid" as const }), timeoutMs: 1000 }, input);
  assert.equal(r.status, 502);
  assert.equal((r.json as { code: string }).code, "AI_FAILED");
});

test("errors never echo the prompt or note", async () => {
  const cases = [
    provider(async () => { throw new Error("purple unicorns Secret Gala"); }),
    provider(async () => ({ refused: true as const })),
  ];
  for (const p of cases) {
    const r = await runCoverTurn({ provider: p, consume: allow, save: saveOk, timeoutMs: 1000 }, input);
    const text = JSON.stringify(r.json);
    for (const secret of ["purple", "unicorn", "Secret Gala", "hush"]) assert.ok(!text.includes(secret));
  }
});

test("remainingQuota counts without inserting", async () => {
  const seen: string[] = [];
  const db = { query: async (text: string) => { seen.push(text); return { rows: [{ count: "2" }] }; } };
  assert.equal(await remainingQuota("k", 3, 86400, db), 1);
  const full = { query: async () => ({ rows: [{ count: "7" }] }) };
  assert.equal(await remainingQuota("k", 3, 86400, full), 0);
  assert.equal(seen.length, 1);
  assert.ok(!/insert|delete/i.test(seen[0]));
});

test("source: UUID checked before permission, no console, remainingQuota read-only", () => {
  const route = readFileSync("src/app/api/ai/cover/route.ts", "utf8");
  assert.ok(route.indexOf("getCoverEventId(") !== -1 && route.indexOf("getCoverEventId(") < route.indexOf("requireEventPermission("));
  for (const f of ["src/app/api/ai/cover/route.ts", "src/app/api/ai/cover/allowance/route.ts", "src/lib/ai/cover-turn.ts"]) {
    assert.ok(!readFileSync(f, "utf8").includes("console."), f);
  }
  const rl = readFileSync("src/lib/rate-limit.ts", "utf8");
  const body = rl.slice(rl.indexOf("export async function remainingQuota"));
  assert.ok(!/INSERT|DELETE/i.test(body.split("\nexport ")[0]));
});
