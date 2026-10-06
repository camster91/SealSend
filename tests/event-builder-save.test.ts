import test from "node:test";
import assert from "node:assert/strict";
import { emptyBuilderData, toPatch } from "../src/lib/event-builder/mapping";
import { createSaveQueue, createSingleFlight, type SaveStatus } from "../src/lib/event-builder/save-machine";

const base = emptyBuilderData("America/Toronto");
const A = { ...base, title: "A" };
const B = { ...A, title: "B", description: "from B" };
const C = { ...B, title: "C", location_name: "The Hall" };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function harness(respond: (patch: object, call: number) => Promise<Response> | Response) {
  const sent: object[] = [];
  const sleeps: number[] = [];
  const statuses: SaveStatus[] = [];
  const queue = createSaveQueue({
    send: async (patch) => { sent.push(patch); return respond(patch, sent.length); },
    now: () => 1234,
    sleep: async (ms) => { sleeps.push(ms); },
  });
  queue.onStatus((s) => statuses.push(s));
  return { queue, sent, sleeps, statuses, last: () => statuses[statuses.length - 1] };
}

test("a save started while another is in flight sends the latest snapshot after it, not before", async () => {
  const firstReply = deferred<Response>();
  const h = harness((_patch, call) => (call === 1 ? firstReply.promise : json(200, {})));
  h.queue.enqueue(base, A);
  await Promise.resolve();
  assert.equal(h.sent.length, 1);
  h.queue.enqueue(A, B);
  h.queue.enqueue(B, C);
  assert.equal(h.sent.length, 1, "nothing else is sent while A is in flight");
  firstReply.resolve(json(200, {}));
  await h.queue.flush();
  assert.deepEqual(h.sent, [toPatch(base, A), toPatch(A, C)]);
  assert.deepEqual(h.last(), { kind: "saved", at: 1234 });
});

test("createDraft is single-flight", async () => {
  let runs = 0;
  const gate = deferred<string>();
  const createDraft = createSingleFlight(() => { runs += 1; return gate.promise; });
  const calls = [createDraft(), createDraft(), createDraft()];
  gate.resolve("event-1");
  assert.deepEqual(await Promise.all(calls), ["event-1", "event-1", "event-1"]);
  assert.equal(runs, 1);
  assert.equal(await createDraft(), "event-1");
  assert.equal(runs, 1);
});

test("createDraft single-flight can be retried after a failure", async () => {
  let runs = 0;
  const createDraft = createSingleFlight(async () => {
    runs += 1;
    if (runs === 1) throw new Error("limit");
    return "event-2";
  });
  await assert.rejects(createDraft(), /limit/);
  assert.equal(await createDraft(), "event-2");
  assert.equal(runs, 2);
});

test("5xx retries after 1s, 2s, 4s then fails", async () => {
  const h = harness(() => json(503, { error: "Service unavailable" }));
  h.queue.enqueue(base, A);
  await h.queue.flush();
  assert.deepEqual(h.sleeps, [1000, 2000, 4000]);
  assert.equal(h.sent.length, 4);
  assert.deepEqual(
    h.statuses.filter((s) => s.kind === "retrying"),
    [{ kind: "retrying", attempt: 1 }, { kind: "retrying", attempt: 2 }, { kind: "retrying", attempt: 3 }],
  );
  assert.equal(h.last().kind, "failed");
});

test("a network error retries and then succeeds", async () => {
  const h = harness((_patch, call) => {
    if (call === 1) throw new TypeError("fetch failed");
    return json(200, {});
  });
  h.queue.enqueue(base, A);
  await h.queue.flush();
  assert.deepEqual(h.sleeps, [1000]);
  assert.deepEqual(h.sent, [toPatch(base, A), toPatch(base, A)]);
  assert.deepEqual(h.last(), { kind: "saved", at: 1234 });
});

test("a retry sends the newest content that arrived while waiting", async () => {
  const sent: object[] = [];
  const queue = createSaveQueue({
    send: async (patch) => { sent.push(patch); return sent.length === 1 ? json(502, {}) : json(200, {}); },
    now: () => 1,
    sleep: async () => { queue.enqueue(A, B); },
  });
  queue.enqueue(base, A);
  await queue.flush();
  assert.deepEqual(sent, [toPatch(base, A), toPatch(base, B)]);
});

test("a 400 with blockers stops retrying and surfaces field errors", async () => {
  const h = harness(() => json(400, {
    error: "Event is not ready to publish",
    blockers: [{ field: "location_name", message: "Add where it's happening." }],
  }));
  h.queue.enqueue(base, A);
  await h.queue.flush();
  assert.deepEqual(h.last(), { kind: "blocked", fieldErrors: { location_name: "Add where it's happening." } });
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.sleeps, []);
});

test("429 shows the server message without retrying", async () => {
  const h = harness(() => json(429, { error: "Too many requests. Try again in a minute." }));
  h.queue.enqueue(base, A);
  await h.queue.flush();
  assert.deepEqual(h.last(), { kind: "failed", message: "Too many requests. Try again in a minute." });
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.sleeps, []);
});

test("a 4xx without an error string fails with the default message", async () => {
  const h = harness(() => new Response("nope", { status: 400 }));
  h.queue.enqueue(base, A);
  await h.queue.flush();
  assert.deepEqual(h.last(), { kind: "failed", message: "Couldn't save your changes." });
  assert.equal(h.sent.length, 1);
});

test("a failed save is included in the next change", async () => {
  const h = harness((_patch, call) => (call === 1 ? json(400, { error: "Validation failed" }) : json(200, {})));
  h.queue.enqueue(base, A);
  await h.queue.flush();
  assert.equal(h.last().kind, "failed");
  h.queue.enqueue(A, B);
  await h.queue.flush();
  assert.deepEqual(h.sent[1], toPatch(base, B));
  assert.deepEqual(h.last(), { kind: "saved", at: 1234 });
});

test("an unsaveable date fails without sending and recovers on the next valid change", async () => {
  const h = harness(() => json(200, {}));
  // 02:30 on 2026-03-08 does not exist in Toronto (clocks spring forward).
  const gap = { ...A, event_date: "2026-03-08T02:30" };
  h.queue.enqueue(base, gap);
  await h.queue.flush();
  assert.equal(h.sent.length, 0);
  assert.deepEqual(h.sleeps, []);
  assert.deepEqual(h.last(), { kind: "failed", message: "That date and time can't be saved. Check the times you entered." });

  const valid = { ...gap, event_date: "2026-03-08T19:00" };
  h.queue.enqueue(gap, valid);
  await h.queue.flush();
  assert.deepEqual(h.sent, [toPatch(base, valid)]);
  assert.deepEqual(h.last(), { kind: "saved", at: 1234 });
});

test("an unchanged snapshot sends nothing", async () => {
  const h = harness(() => json(200, {}));
  h.queue.enqueue(A, A);
  await h.queue.flush();
  assert.equal(h.sent.length, 0);
  assert.deepEqual(h.statuses, []);
});

test("onStatus returns an unsubscribe function", async () => {
  const h = harness(() => json(200, {}));
  const seen: SaveStatus[] = [];
  const off = h.queue.onStatus((s) => seen.push(s));
  off();
  h.queue.enqueue(base, A);
  await h.queue.flush();
  assert.deepEqual(seen, []);
  assert.equal(h.last().kind, "saved");
});
