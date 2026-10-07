import assert from "node:assert/strict";
import test from "node:test";
import { chatRequestSchema } from "../src/lib/ai/chat-schema";
import {
  buildChatRequest,
  chatErrorFor,
  chipsForTurn,
  droppedDate,
  latestAssistantGroup,
  shouldApplyReply,
  FAILED_MESSAGE,
  LIMIT_MESSAGE,
  localToday,
  openingState,
  READY_MESSAGE,
  REVIEW_CHIP,
  shouldCreateDraft,
} from "../src/lib/event-builder/chat-client";
import { emptyBuilderData } from "../src/lib/event-builder/mapping";

const data = { ...emptyBuilderData("America/Toronto"), title: "Sam's party", max_attendees: 40 };

test("buildChatRequest keeps only the last 12 messages, each capped at 1000 chars", () => {
  const messages = Array.from({ length: 15 }, (_, i) => ({
    role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
    text: i === 14 ? "x".repeat(1500) : `m${i}`,
  }));
  const body = buildChatRequest({ messages, data, today: "2026-10-07", timezone: "America/Toronto" });
  assert.equal(body.messages.length, 12);
  assert.equal(body.messages[0].text, "m3");
  assert.equal(body.messages[11].text.length, 1000);
  assert.ok(chatRequestSchema.safeParse(body).success, "the route accepts it");
});

test("buildChatRequest sends exactly the 11 chat fields and the event id only when set", () => {
  const body = buildChatRequest({ messages: [{ role: "user", text: "hi" }], data, today: "2026-10-07", timezone: "UTC" });
  assert.deepEqual(Object.keys(body.data).sort(), [
    "description", "dress_code", "event_date", "event_end_date", "host_name", "invitation_body",
    "invitation_headline", "location_address", "location_name", "max_attendees", "title",
  ]);
  assert.equal(body.data.title, "Sam's party");
  assert.equal("eventId" in body, false);
  const id = "6f1c2b9e-3a1d-4c55-9b1e-2f8a7d6c5b4a";
  const withId = buildChatRequest({ eventId: id, messages: [{ role: "user", text: "hi" }], data, today: "2026-10-07", timezone: "UTC" });
  assert.equal(withId.eventId, id);
  assert.ok(chatRequestSchema.safeParse(withId).success);
});

test("buildChatRequest caps long field values so the route never rejects the snapshot", () => {
  const long = { ...data, title: "t".repeat(300), invitation_body: "b".repeat(2500) };
  const body = buildChatRequest({ messages: [{ role: "user", text: "hi" }], data: long, today: "2026-10-07", timezone: "UTC" });
  assert.ok(chatRequestSchema.safeParse(body).success);
});

test("localToday uses the local calendar date", () => {
  assert.equal(localToday(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
});

test("chatErrorFor maps codes to the exact copy", () => {
  assert.deepEqual(chatErrorFor(429, { code: "AI_CHAT_LIMIT" }), { message: LIMIT_MESSAGE, retry: false, blocked: true });
  assert.deepEqual(chatErrorFor(502, { code: "AI_FAILED" }), { message: FAILED_MESSAGE, retry: true, blocked: false });
  assert.deepEqual(chatErrorFor(503, { code: "AI_UNAVAILABLE" }), { message: FAILED_MESSAGE, retry: false, blocked: true });
  assert.equal(chatErrorFor(0, null).retry, true, "a network error can be retried");
  const bad = chatErrorFor(400, { error: "Invalid request." });
  assert.equal(bad.retry, false);
  assert.equal(bad.blocked, false);
  assert.ok(bad.message.length > 0);
  assert.equal(LIMIT_MESSAGE, "You've used today's AI help. Keep going in manual mode — everything you've filled in is saved.");
  assert.equal(FAILED_MESSAGE, "The assistant is having trouble right now.");
});

test("openingState greets new and returning hosts", () => {
  assert.deepEqual(openingState(false), {
    text: "Hi! What are you planning?",
    chips: ["Birthday party", "Community dinner", "Wedding", "Something else"],
  });
  assert.deepEqual(openingState(true), { text: "Welcome back! What would you like to change?", chips: [] });
});

test("chipsForTurn puts Review & publish first when ready and drops duplicates", () => {
  assert.deepEqual(chipsForTurn({ ready: false, chips: ["6 pm"] }), ["6 pm"]);
  assert.deepEqual(chipsForTurn({ ready: true, chips: ["More fun", "Review & publish"] }), [REVIEW_CHIP, "More fun"]);
  assert.equal(READY_MESSAGE, "Looks ready! Review and publish?");
});

test("shouldCreateDraft only once a title exists and no draft yet", () => {
  assert.equal(shouldCreateDraft(undefined, { title: "  " }), false);
  assert.equal(shouldCreateDraft(undefined, { title: "Party" }), true);
  assert.equal(shouldCreateDraft("id", { title: "Party" }), false);
});

test("shouldApplyReply drops a reply that lands after the host left", () => {
  assert.equal(shouldApplyReply(0, 0), true);
  assert.equal(shouldApplyReply(0, 1), false);
});

test("droppedDate only counts the two date fields", () => {
  assert.equal(droppedDate(["event_date"]), true);
  assert.equal(droppedDate(["event_end_date", "max_attendees"]), true);
  assert.equal(droppedDate(["max_attendees"]), false);
  assert.equal(droppedDate([]), false);
});

test("latestAssistantGroup returns every assistant message since the last user message", () => {
  const log = [
    { id: 0, role: "assistant" as const, text: "Hi" },
    { id: 1, role: "user" as const, text: "Party" },
    { id: 2, role: "assistant" as const, text: "Great" },
    { id: 3, role: "assistant" as const, text: "Looks ready! Review and publish?" },
  ];
  assert.deepEqual(latestAssistantGroup(log).map((m) => m.id), [2, 3]);
  assert.deepEqual(latestAssistantGroup(log.slice(0, 2)), []);
  assert.deepEqual(latestAssistantGroup(log.slice(0, 1)).map((m) => m.id), [0]);
});
