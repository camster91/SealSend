import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReadinessCandidate,
  describePublishError,
  primaryAction,
  rsvpFieldsChanged,
} from "../src/lib/event-builder/review";
import { emptyBuilderData } from "../src/lib/event-builder/mapping";
import { getPublicationReadiness } from "../src/lib/publication-readiness";

const field = (over = {}) => ({
  field_name: "attendance",
  field_type: "attendance" as const,
  field_label: "Will you come?",
  is_required: true,
  is_enabled: true,
  options: null,
  placeholder: null,
  ...over,
});

test("a draft shows Publish; a published event shows Save changes", () => {
  assert.equal(primaryAction({ published: false }).kind, "publish");
  assert.equal(primaryAction({ published: false }).label, "Publish");
  assert.equal(primaryAction({ published: true }).kind, "save");
  assert.equal(primaryAction({ published: true }).label, "Save changes");
});

test("a published event never calls publish", () => {
  assert.equal(primaryAction({ published: true }).callsPublish, false);
  assert.equal(primaryAction({ published: false }).callsPublish, true);
});

test("the readiness candidate turns zoned-local dates into instants", () => {
  const data = { ...emptyBuilderData("America/Toronto"), title: "Party", location_name: "Home", event_date: "2026-12-01T18:00" };
  const c = buildReadinessCandidate(data);
  assert.equal(c.event_date, "2026-12-01T23:00:00.000Z");
  assert.equal(getPublicationReadiness(c).ready, true);
});

test("an empty draft is missing title, start and place", () => {
  const blockers = getPublicationReadiness(buildReadinessCandidate(emptyBuilderData("UTC"))).blockers.map((b) => b.field);
  assert.deepEqual(blockers, ["title", "event_date", "location_name"]);
});

test("rsvpFieldsChanged compares by value", () => {
  assert.equal(rsvpFieldsChanged([field()], [field()]), false);
  assert.equal(rsvpFieldsChanged([field()], [field({ field_label: "Coming?" })]), true);
  assert.equal(rsvpFieldsChanged([field()], [field({ is_enabled: false })]), true);
  assert.equal(rsvpFieldsChanged([field()], []), true);
});

test("publish errors become plain words", () => {
  assert.deepEqual(describePublishError(400, { error: "x", blockers: [{ field: "title", message: "Add a name for your event." }] }).blockers, [
    { field: "title", message: "Add a name for your event." },
  ]);
  const generic = describePublishError(500, { error: "Internal server error" });
  assert.match(generic.message ?? "", /Something went wrong/);
  assert.match(describePublishError(409, { error: "Archived events cannot be published directly." }).message ?? "", /archived/i);
  assert.deepEqual(describePublishError(0, null).blockers, []);
});
