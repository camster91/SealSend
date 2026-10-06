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

import { createRsvpSaver, prepareRsvpFields, RSVP_SAVE_FAILED } from "../src/lib/event-builder/review";

function harness(sendImpl?: (f: unknown[], n: number) => Promise<string | undefined>) {
  const sleeps: Array<() => void> = [];
  const sent: unknown[][] = [];
  const errors: Array<string | undefined> = [];
  const saver = createRsvpSaver({
    sleep: () => new Promise<void>((r) => sleeps.push(r)),
    send: async (f) => {
      sent.push(f);
      return sendImpl ? sendImpl(f, sent.length) : undefined;
    },
    onError: (m) => errors.push(m),
  });
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return { saver, sleeps, sent, errors, tick };
}

test("edits debounce into one PUT", async () => {
  const h = harness();
  h.saver.schedule([field({ field_label: "a" })]);
  h.saver.schedule([field({ field_label: "ab" })]);
  h.sleeps.forEach((r) => r());
  await h.tick();
  assert.equal(h.sent.length, 1);
  assert.equal((h.sent[0][0] as { field_label: string }).field_label, "ab");
});

test("an edit during an in-flight PUT is sent after it with the latest array", async () => {
  let release: () => void = () => {};
  const h = harness((_f, n) => (n === 1 ? new Promise((r) => { release = () => r(undefined); }) : Promise.resolve(undefined)));
  h.saver.schedule([field({ field_label: "one" })]);
  h.sleeps[0]();
  await h.tick();
  h.saver.schedule([field({ field_label: "two" })]);
  h.sleeps[1]();
  await h.tick();
  assert.equal(h.sent.length, 1, "never two in flight");
  release();
  await h.tick();
  assert.equal(h.sent.length, 2);
  assert.equal((h.sent[1][0] as { field_label: string }).field_label, "two");
});

test("a failed PUT keeps the edit pending and reports an error", async () => {
  const h = harness((_f, n) => Promise.resolve(n === 1 ? RSVP_SAVE_FAILED : undefined));
  h.saver.schedule([field({ field_label: "x" })]);
  assert.equal(await h.saver.flush(), RSVP_SAVE_FAILED);
  assert.deepEqual(h.errors, [RSVP_SAVE_FAILED]);
  assert.equal(await h.saver.flush(), undefined, "flush resends the pending edit");
  assert.equal(h.sent.length, 2);
  assert.equal(h.errors.at(-1), undefined);
});

test("flush sends a pending edit at once and waits for it", async () => {
  const h = harness();
  h.saver.schedule([field()]);
  assert.equal(await h.saver.flush(), undefined);
  assert.equal(h.sent.length, 1);
  h.sleeps[0]();
  await h.tick();
  assert.equal(h.sent.length, 1, "the old debounce does not send twice");
});

test("a blank label only blocks switched-on questions", () => {
  assert.ok(prepareRsvpFields([field({ field_label: " " })]).problem);
  const off = prepareRsvpFields([field({ field_label: "", is_enabled: false, field_name: "diet" })]);
  assert.equal(off.problem, undefined);
  assert.equal(off.fields[0].field_label, "diet");
  assert.doesNotMatch(prepareRsvpFields([field({ field_label: "" })]).problem ?? "", /off/i);
});
