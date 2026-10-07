import test from "node:test";
import assert from "node:assert/strict";
import { chatRequestSchema, sanitizeChatTurn } from "../src/lib/ai/chat-schema";

const base = { reply: "Hi", chips: [], updates: {}, overwrite: [], ready: false };

test("invalid fields are dropped and valid ones kept", () => {
  const turn = sanitizeChatTurn({
    ...base,
    updates: { title: "Dinner", max_attendees: 0, location_name: "x".repeat(500), evil_url: "https://x" },
    overwrite: ["title", "nope"],
  });
  assert.ok(turn);
  assert.deepEqual(turn.updates, { title: "Dinner" });
  assert.deepEqual(turn.overwrite, ["title"]);
});

test("bad local dates are dropped", () => {
  const bad = sanitizeChatTurn({ ...base, updates: { event_date: "next Saturday" } });
  assert.deepEqual(bad?.updates, {});
  const good = sanitizeChatTurn({ ...base, updates: { event_date: "2026-10-11T18:00" } });
  assert.deepEqual(good?.updates, { event_date: "2026-10-11T18:00" });
});

test("chips are capped at 4 and 40 chars", () => {
  const turn = sanitizeChatTurn({ ...base, chips: ["a", "b".repeat(41), "c", "d", "e", "f"] });
  assert.deepEqual(turn?.chips, ["a", "c", "d", "e"]);
});

test("reply over 400 chars is truncated", () => {
  const turn = sanitizeChatTurn({ ...base, reply: "y".repeat(450) });
  assert.equal(turn?.reply.length, 400);
  assert.ok(turn?.reply.endsWith("…"));
});

test("a missing reply returns null", () => {
  assert.equal(sanitizeChatTurn({ chips: [] }), null);
  assert.equal(sanitizeChatTurn({ reply: 5 }), null);
  assert.equal(sanitizeChatTurn(null), null);
});

test("request schema rejects 13 messages and 1001-char messages", () => {
  const msg = (content: string) => ({ role: "user", content });
  const ok = { messages: [msg("hi")], data: {}, today: "2026-10-07", timezone: "America/Toronto" };
  assert.equal(chatRequestSchema.safeParse(ok).success, true);
  assert.equal(
    chatRequestSchema.safeParse({ ...ok, messages: Array.from({ length: 13 }, () => msg("hi")) }).success,
    false,
  );
  assert.equal(chatRequestSchema.safeParse({ ...ok, messages: [msg("x".repeat(1001))] }).success, false);
});

test("request data accepts null max_attendees and empty strings", () => {
  const data = {
    title: "",
    description: "",
    host_name: null,
    dress_code: "",
    event_date: "",
    event_end_date: null,
    location_name: "",
    location_address: "",
    max_attendees: null,
    invitation_headline: "",
    invitation_body: "",
  };
  const res = chatRequestSchema.safeParse({
    messages: [{ role: "user", content: "hi" }],
    data,
    today: "2026-10-07",
    timezone: "America/Toronto",
  });
  assert.equal(res.success, true);
});
