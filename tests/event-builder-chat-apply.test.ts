import test from "node:test";
import assert from "node:assert/strict";
import { applyChatUpdates, markHostEdited } from "../src/lib/event-builder/chat-apply";
import { emptyBuilderData } from "../src/lib/event-builder/mapping";
import type { ChatEventField, ChatTurn } from "../src/lib/ai/chat-schema";

const turn = (updates: ChatTurn["updates"], overwrite: ChatEventField[] = []): ChatTurn => ({
  reply: "ok",
  chips: [],
  updates,
  overwrite,
  ready: false,
});

test("fills blank fields", () => {
  const data = emptyBuilderData("America/Toronto");
  const r = applyChatUpdates(data, turn({ title: "Party", max_attendees: 20, event_date: "2026-06-01T19:00" }), {
    aiOwned: new Set(),
    latestUserText: "hi",
  });
  assert.equal(r.patch.title, "Party");
  assert.equal(r.patch.max_attendees, 20);
  assert.equal(r.patch.event_date, "2026-06-01T19:00");
  assert.deepEqual([...r.aiOwned].sort(), ["event_date", "max_attendees", "title"]);
  assert.deepEqual(r.dropped, []);
});

test("a host-edited field is not overwritten unless the latest message names it", () => {
  const data = { ...emptyBuilderData("America/Toronto"), title: "Ana's 30th" };
  const kept = applyChatUpdates(data, turn({ title: "Birthday party" }), {
    aiOwned: new Set(),
    latestUserText: "make it 7pm",
  });
  assert.equal(kept.patch.title, undefined);
  assert.equal(kept.aiOwned.has("title"), false);
  const unnamed = applyChatUpdates(data, turn({ title: "Birthday party" }, ["title"]), {
    aiOwned: new Set(),
    latestUserText: "make it 7pm",
  });
  assert.equal(unnamed.patch.title, undefined);
  const changed = applyChatUpdates(data, turn({ title: "Ana's big 30th" }, ["title"]), {
    aiOwned: new Set(),
    latestUserText: "call it Ana's big 30th",
  });
  assert.equal(changed.patch.title, "Ana's big 30th");
  assert.equal(changed.aiOwned.has("title"), true);
});

test("ai-owned fields can be refined", () => {
  const data = { ...emptyBuilderData("America/Toronto"), title: "Party" };
  const r = applyChatUpdates(data, turn({ title: "Garden party" }), {
    aiOwned: new Set<ChatEventField>(["title"]),
    latestUserText: "ok",
  });
  assert.equal(r.patch.title, "Garden party");
});

test("an impossible local time is dropped without losing other updates", () => {
  const data = emptyBuilderData("America/Toronto");
  const r = applyChatUpdates(data, turn({ event_date: "2026-03-08T02:30", location_name: "The Loft" }), {
    aiOwned: new Set(),
    latestUserText: "x",
  });
  assert.deepEqual(r.dropped, ["event_date"]);
  assert.equal(r.patch.event_date, undefined);
  assert.equal(r.patch.location_name, "The Loft");
  assert.equal(r.aiOwned.has("event_date"), false);
});

test("markHostEdited removes fields", () => {
  const owned = new Set<ChatEventField>(["title", "event_date"]);
  const next = markHostEdited(owned, ["title", "bogus"]);
  assert.deepEqual([...next], ["event_date"]);
  assert.equal(owned.has("title"), true);
});
