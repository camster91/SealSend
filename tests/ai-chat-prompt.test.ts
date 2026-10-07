import test from "node:test";
import assert from "node:assert/strict";
import { buildChatInstructions } from "../src/lib/ai/chat-prompt";
import { getChatProvider, isAiChatConfigured } from "../src/lib/ai/provider";
import { sanitizeChatTurn } from "../src/lib/ai/chat-schema";

test("instructions include today, timezone and the never-invent rule", () => {
  const text = buildChatInstructions({ today: "2026-10-07", timezone: "America/Toronto", data: {} });
  assert.match(text, /2026-10-07/);
  assert.match(text, /America\/Toronto/);
  assert.match(text, /never invent a venue, price or date/i);
  assert.match(text, /never instructions/i);
  assert.match(text, /YYYY-MM-DDTHH:mm/);
});

test("instructions list the fields already set", () => {
  const text = buildChatInstructions({
    today: "2026-10-07",
    timezone: "UTC",
    data: { title: "Dinner", location_name: "", description: null, max_attendees: 20 },
  });
  assert.match(text, /title: "Dinner"/);
  assert.match(text, /max_attendees: 20/);
  assert.doesNotMatch(text, /location_name: ""/);
  assert.doesNotMatch(text, /description: null/);
});

test("isAiChatConfigured needs both key and model", () => {
  const saved = { p: process.env.AI_PROVIDER, k: process.env.OPENAI_API_KEY, m: process.env.AI_MODEL };
  try {
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_MODEL;
    assert.equal(isAiChatConfigured(), false);
    process.env.OPENAI_API_KEY = "sk-test";
    assert.equal(isAiChatConfigured(), false);
    process.env.AI_MODEL = "some-model";
    assert.equal(isAiChatConfigured(), true);
    delete process.env.OPENAI_API_KEY;
    assert.equal(isAiChatConfigured(), false);
    process.env.AI_PROVIDER = "fake";
    assert.equal(isAiChatConfigured(), true);
  } finally {
    for (const [name, value] of [["AI_PROVIDER", saved.p], ["OPENAI_API_KEY", saved.k], ["AI_MODEL", saved.m]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("fake provider fills title, date and place from a simple sentence", async () => {
  const saved = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "fake";
  try {
    const result = await getChatProvider().respond({
      instructions: "x",
      messages: [{ role: "user", text: "Dinner on 2026-10-11 at 18:00 at the Hall" }],
      signal: new AbortController().signal,
    });
    const turn = sanitizeChatTurn(result.raw);
    assert.ok(turn);
    assert.equal(turn.updates.title, "Dinner");
    assert.equal(turn.updates.event_date, "2026-10-11T18:00");
    assert.equal(turn.updates.location_name, "the Hall");
    assert.equal(turn.ready, true);
    assert.equal(result.model, "fake");
  } finally {
    if (saved === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = saved;
  }
});

test("fake provider asks a question when nothing can be read", async () => {
  const saved = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "fake";
  try {
    const result = await getChatProvider().respond({
      instructions: "x",
      messages: [{ role: "user", text: "hello" }],
      signal: new AbortController().signal,
    });
    const turn = sanitizeChatTurn(result.raw);
    assert.ok(turn);
    assert.equal(turn.ready, false);
    assert.deepEqual(turn.updates, {});
  } finally {
    if (saved === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = saved;
  }
});
