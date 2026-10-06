import test from "node:test";
import assert from "node:assert/strict";
import { decideStart } from "../src/lib/event-builder/start-decision";

const draft = { id: "d1", status: "draft" as const, title: "Picnic" };
const live = { id: "p1", status: "published" as const, title: "Gala" };

test("no events and room to create gives the fresh view", () => {
  assert.deepEqual(decideStart([], true), { kind: "fresh" });
});

test("one draft at the limit continues that draft", () => {
  assert.deepEqual(decideStart([draft], false), { kind: "continue-draft", eventId: "d1", title: "Picnic" });
});

test("one published event at the limit is at-limit", () => {
  assert.deepEqual(decideStart([live], false), { kind: "at-limit", eventId: "p1", title: "Gala" });
});

test("events present but creation allowed gives the fresh view", () => {
  assert.deepEqual(decideStart([draft, live], true), { kind: "fresh" });
});

test("draft plus published at the limit points at the draft", () => {
  assert.deepEqual(decideStart([live, draft], false), { kind: "continue-draft", eventId: "d1", title: "Picnic" });
});
