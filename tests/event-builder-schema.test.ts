import test from "node:test";
import assert from "node:assert/strict";
import { eventUpdateSchema } from "../src/lib/validations";
import { builderDataSchema } from "../src/lib/event-builder/schema";
import { builderDataToPreviewEvent, emptyBuilderData, fromEvent, toPatch } from "../src/lib/event-builder/mapping";
import type { Event } from "../src/types/database";

const filled = {
  ...emptyBuilderData("America/Toronto"),
  title: "Summer party",
  description: "Come along",
  event_date: "2026-07-10T19:00",
  event_end_date: "2026-07-10T22:00",
  location_name: "The Hall",
  location_address: "1 Main St",
  host_name: "Sam",
  dress_code: "Casual",
  rsvp_deadline: "2026-07-01T12:00",
  registry_links: [{ label: "Gifts", url: "https://example.com/gifts" }],
  max_attendees: 80,
  allow_plus_ones: true,
  max_guests_per_rsvp: 3,
  design_url: "https://example.com/design.png",
  design_type: "image",
  invitation_headline: "You are invited",
  invitation_body: "Join us",
  event_brief: null,
};

test("schema accepts what eventUpdateSchema accepts", () => {
  assert.equal(builderDataSchema.safeParse(filled).success, true);
  const patch = toPatch(emptyBuilderData("UTC"), filled);
  assert.ok(patch);
  const parsed = eventUpdateSchema.safeParse(patch);
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
});

test("toPatch sends only changed fields", () => {
  assert.deepEqual(toPatch(filled, { ...filled, title: "New" }), { title: "New" });
});

test("toPatch returns null when nothing changed", () => {
  assert.equal(toPatch(filled, { ...filled }), null);
  assert.equal(toPatch(filled, { ...filled, rsvp_fields: [] }), null);
});

test("date fields round-trip through toPatch/fromEvent in the event timezone", () => {
  const next = { ...emptyBuilderData("America/Toronto"), event_date: "2026-11-01T01:30" };
  const patch = toPatch(emptyBuilderData("America/Toronto"), next);
  assert.ok(patch?.event_date);
  const event = { event_date: patch.event_date, event_timezone: "America/Toronto", customization: null } as unknown as Event;
  assert.equal(fromEvent(event, []).event_date, "2026-11-01T01:30");
});

test("clearing a date sends null", () => {
  assert.deepEqual(toPatch(filled, { ...filled, rsvp_deadline: "" }), { rsvp_deadline: null });
});

test("a cleared date patch passes eventUpdateSchema", () => {
  const patch = toPatch(filled, { ...filled, event_end_date: "" });
  assert.deepEqual(patch, { event_end_date: null });
  assert.equal(eventUpdateSchema.safeParse(patch).success, true);
});

test("preview event from blank data does not throw and leaves dates null", () => {
  const event = builderDataToPreviewEvent(emptyBuilderData("America/Toronto"));
  assert.equal(event.event_date, null);
  assert.equal(event.event_end_date, null);
  assert.equal(event.rsvp_deadline, null);
  assert.equal(event.title, "");
});

test("preview event turns a zoned-local date into the right instant", () => {
  const event = builderDataToPreviewEvent(filled);
  assert.equal(event.event_date, "2026-07-10T23:00:00.000Z");
  assert.equal(event.event_timezone, "America/Toronto");
});

test("preview event tolerates an invalid date", () => {
  const event = builderDataToPreviewEvent({ ...filled, event_date: "not a date" });
  assert.equal(event.event_date, null);
});
