import test from "node:test";
import assert from "node:assert/strict";
import { validateBasics } from "../src/lib/event-builder/basics-validation";
import { emptyBuilderData } from "../src/lib/event-builder/mapping";

const filled = {
  ...emptyBuilderData("America/Toronto"),
  title: "Summer party",
  event_date: "2026-07-10T19:00",
  event_end_date: "2026-07-10T22:00",
  location_name: "The Hall",
  rsvp_deadline: "2026-07-01T12:00",
};

test("end before start", () => {
  const errors = validateBasics({ ...filled, event_end_date: "2026-07-10T18:00" }, { published: false });
  assert.deepEqual(errors, { event_end_date: "The end time needs to be after the start." });
});

test("deadline after start", () => {
  const errors = validateBasics({ ...filled, rsvp_deadline: "2026-07-11T09:00" }, { published: false });
  assert.deepEqual(errors, { rsvp_deadline: "The RSVP deadline needs to be before the event." });
});

test("a published event cannot lose its place", () => {
  const errors = validateBasics({ ...filled, location_name: "  " }, { published: true });
  assert.deepEqual(errors, { location_name: "A published event needs a place." });
});

test("drafts may leave everything blank", () => {
  assert.deepEqual(validateBasics(emptyBuilderData("America/Toronto"), { published: false }), {});
});

test("a good set of dates has no errors", () => {
  assert.deepEqual(validateBasics(filled, { published: true }), {});
});

import { readFileSync } from "node:fs";

test("basics screen files keep to the tokens and copy rules", () => {
  const dir = "src/components/events/builder/screens/";
  for (const file of ["BasicsScreen.tsx", "BasicsMoreOptions.tsx", "Field.tsx"]) {
    const src = readFileSync(`${dir}${file}`, "utf8");
    for (const word of ["gray-", "indigo", "#6366f1", "brand-600", "publish blocker", "operations brief", "explicit decisions", "communication plan"]) {
      assert.ok(!src.includes(word), `${file} contains ${word}`);
    }
  }
  const screen = readFileSync(`${dir}BasicsScreen.tsx`, "utf8");
  assert.ok(screen.includes("When and where?"));
  assert.match(screen, /<h1 className="font-display/);
  assert.ok(screen.includes("ensureDraft"));
});

import { resolveHeld } from "../src/lib/event-builder/basics-validation";

test("resolveHeld holds a bad end time on a published event, sends a good one", () => {
  const bad = resolveHeld(filled, {}, { event_end_date: "2026-07-10T18:00" }, true);
  assert.deepEqual(bad.send, {});
  assert.deepEqual(bad.held, { event_end_date: "2026-07-10T18:00" });
  const good = resolveHeld(filled, {}, { event_end_date: "2026-07-10T23:00" }, true);
  assert.deepEqual(good.send, { event_end_date: "2026-07-10T23:00" });
});

test("fixing the start releases a held end time", () => {
  const held = { event_end_date: "2026-07-10T18:00" };
  const r = resolveHeld(filled, held, { event_date: "2026-07-10T17:00" }, true);
  assert.deepEqual(r.held, {});
  assert.deepEqual(r.send, { event_end_date: "2026-07-10T18:00", event_date: "2026-07-10T17:00" });
  assert.deepEqual(r.errors, {});
});

test("fixing the start releases a held RSVP deadline", () => {
  const held = { rsvp_deadline: "2026-07-11T09:00" };
  const r = resolveHeld(filled, held, { event_date: "2026-07-12T19:00", event_end_date: "2026-07-12T22:00" }, true);
  assert.deepEqual(r.held, {});
  assert.equal(r.send.rsvp_deadline, "2026-07-11T09:00");
});

test("a held timezone is released once nothing is flagged", () => {
  const held = { event_timezone: "Europe/London", event_end_date: "2026-07-10T18:00" };
  const still = resolveHeld(filled, held, { location_address: "1 Main St" }, true);
  assert.ok("event_timezone" in still.held && "event_end_date" in still.held);
  const fixed = resolveHeld(filled, held, { event_end_date: "2026-07-10T23:00" }, true);
  assert.deepEqual(fixed.held, {});
  assert.equal(fixed.send.event_timezone, "Europe/London");
});

test("drafts send everything and hold nothing", () => {
  const r = resolveHeld(filled, {}, { event_end_date: "2026-07-10T18:00" }, false);
  assert.deepEqual(r.send, { event_end_date: "2026-07-10T18:00" });
  assert.deepEqual(r.held, {});
  assert.ok(r.errors.event_end_date);
});
