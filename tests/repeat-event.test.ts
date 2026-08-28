import assert from "node:assert/strict";
import test from "node:test";
import { parseRepeatEventRequest } from "../src/lib/repeat-event";

const reference = new Date("2026-08-27T12:00:00.000Z");

test("repeat-event input requires a new future schedule", () => {
  assert.throws(() => parseRepeatEventRequest({
    title: "September gathering",
    eventDate: "2026-08-27T11:59:00.000Z",
    includeGuests: false,
  }, reference), /future/i);
});

test("repeat-event input keeps end and RSVP deadlines ordered", () => {
  assert.throws(() => parseRepeatEventRequest({
    title: "September gathering",
    eventDate: "2026-09-10T22:00:00.000Z",
    eventEndDate: "2026-09-10T21:00:00.000Z",
    includeGuests: true,
  }, reference), /end/i);

  assert.throws(() => parseRepeatEventRequest({
    title: "September gathering",
    eventDate: "2026-09-10T22:00:00.000Z",
    rsvpDeadline: "2026-09-11T22:00:00.000Z",
    includeGuests: true,
  }, reference), /deadline/i);
});

test("repeat-event input is strict, trims the title, and defaults to no guest copy", () => {
  const parsed = parseRepeatEventRequest({
    title: "  September gathering  ",
    eventDate: "2026-09-10T22:00:00.000Z",
  }, reference);
  assert.equal(parsed.title, "September gathering");
  assert.equal(parsed.includeGuests, false);
  assert.equal(parsed.eventEndDate, null);
  assert.equal(parsed.rsvpDeadline, null);

  assert.throws(() => parseRepeatEventRequest({
    title: "September gathering",
    eventDate: "2026-09-10T22:00:00.000Z",
    copyResponses: true,
  }, reference));
});
