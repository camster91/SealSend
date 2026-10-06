import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RSVP_FIELDS } from "../src/lib/constants";
import { EVENT_TEMPLATES } from "../src/lib/event-templates";
import { eventCreateSchema, eventUpdateSchema } from "../src/lib/validations";
import { basicsErrors, resolveHeld, validateBasics } from "../src/lib/event-builder/basics-validation";
import { checkLink, checkRegistryLink, DRAFT_NAME_ERROR, LINK_ERROR, textLimitErrors } from "../src/lib/event-builder/field-checks";
import { applyStyle, uploadFailureMessage } from "../src/lib/event-builder/look";
import { emptyBuilderData, fromEvent, toBuilderRsvpFields, toPatch } from "../src/lib/event-builder/mapping";
import { CHANGES_NOT_SAVED, flushProblem, saveThenAct } from "../src/lib/event-builder/review";
import {
  createDraftCreator,
  createSaveQueue,
  describeSaveError,
  type SaveStatus,
} from "../src/lib/event-builder/save-machine";
import type { BuilderData, BuilderRsvpField } from "../src/lib/event-builder/schema";
import type { Event } from "../src/types/database";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const template = EVENT_TEMPLATES[0];
const base = emptyBuilderData("America/Toronto");
const named = { ...base, title: "Sam's party" };

function queueWith(respond: () => Response) {
  const sent: object[] = [];
  const queue = createSaveQueue({
    send: async (patch) => { sent.push(patch); return respond(); },
    now: () => 99,
    sleep: async () => undefined,
  });
  return { queue, sent };
}

// ---- C1: the real draft bodies pass the server schemas ----

test("C1: the draft POST body the creator builds from a template passes eventCreateSchema", async () => {
  const data: BuilderData = { ...emptyBuilderData("America/Toronto", template.customization), title: "Garden party" };
  const posts: object[] = [];
  const ensureDraft = createDraftCreator({
    post: async (body) => { posts.push(body); return json(201, { id: "e1" }); },
    getData: () => data,
    organizationId: undefined,
    queue: { enqueue: () => undefined },
    now: () => 1,
    onCreated: () => undefined,
    report: () => undefined,
  });
  await ensureDraft();
  assert.equal(posts.length, 1);
  const parsed = eventCreateSchema.safeParse(posts[0]);
  assert.ok(parsed.success, JSON.stringify(parsed.error?.flatten()));
  assert.equal(parsed.data.customization?.logoUrl, null, "a blank logo is saved as not set");
  assert.equal(parsed.data.customization?.backgroundImage, null);
  assert.equal(parsed.data.customization?.audioUrl, null);
});

test("C1: a toPatch that only changes the main colour passes eventUpdateSchema", () => {
  const prev = { ...emptyBuilderData("America/Toronto", template.customization), title: "Garden party" };
  const next = { ...prev, customization: { ...prev.customization, primaryColor: "#123456" } };
  const patch = toPatch(prev, next);
  assert.deepEqual(Object.keys(patch ?? {}), ["customization"]);
  const parsed = eventUpdateSchema.safeParse(patch);
  assert.ok(parsed.success, JSON.stringify(parsed.error?.flatten()));
});

// ---- I1a: flush reports how saving ended ----

test("flush returns failed status when the last save failed", async () => {
  const { queue } = queueWith(() => json(400, { error: "Validation failed", details: { fieldErrors: { design_url: ["bad"] } } }));
  queue.enqueue(base, named);
  const status = await queue.flush();
  assert.deepEqual(status, { kind: "failed", message: "Check the image link." });
});

test("flush returns blocked status when the server lists blockers", async () => {
  const { queue } = queueWith(() => json(400, { error: "Event is not ready to publish", blockers: [{ field: "title", message: "Add a name." }] }));
  queue.enqueue(base, named);
  assert.deepEqual(await queue.flush(), { kind: "blocked", fieldErrors: { title: "Add a name." } });
});

test("flush returns saved once the save lands, and idle when nothing was sent", async () => {
  const idle = queueWith(() => json(200, {}));
  assert.deepEqual(await idle.queue.flush(), { kind: "idle" });
  const ok = queueWith(() => json(200, {}));
  ok.queue.enqueue(base, named);
  assert.deepEqual(await ok.queue.flush(), { kind: "saved", at: 99 });
});

// ---- I1a/d: Review stops when a save did not land ----

function reviewDeps(status: SaveStatus, questions?: string) {
  const acted: string[] = [];
  return {
    acted,
    deps: {
      ensureDraft: async () => "e1",
      flush: async () => status,
      flushQuestions: async () => questions,
      act: async (id: string) => { acted.push(id); },
    },
  };
}

test("Review does not publish when flush reports failed", async () => {
  const { acted, deps } = reviewDeps({ kind: "failed", message: "Check the image link." });
  const problem = await saveThenAct(deps);
  assert.deepEqual(acted, [], "publish (or navigation) never runs");
  assert.deepEqual(problem, { message: CHANGES_NOT_SAVED, details: ["Check the image link."] });
  assert.equal(CHANGES_NOT_SAVED, "Some changes didn't save yet. Fix the highlighted fields, then try again.");
});

test("Review does not publish when flush reports blocked", async () => {
  const { acted, deps } = reviewDeps({ kind: "blocked", fieldErrors: { title: "Add a name.", location_name: "Add a place." } });
  const problem = await saveThenAct(deps);
  assert.deepEqual(acted, []);
  assert.deepEqual(problem?.details, ["Add a name.", "Add a place."]);
});

test("Review does not act when the questions did not save", async () => {
  const { acted, deps } = reviewDeps({ kind: "saved", at: 1 }, "Something went wrong, so your questions were not saved.");
  const problem = await saveThenAct(deps);
  assert.deepEqual(acted, []);
  assert.equal(problem?.message, "Something went wrong, so your questions were not saved.");
});

test("Review acts once everything saved", async () => {
  const { acted, deps } = reviewDeps({ kind: "saved", at: 1 });
  assert.equal(await saveThenAct(deps), null);
  assert.deepEqual(acted, ["e1"]);
  assert.equal(flushProblem({ kind: "idle" }), null);
});

// ---- I1c: save errors in plain words ----

test("a 400 with details names the fields in plain words", () => {
  assert.equal(describeSaveError(400, { error: "Validation failed", details: { fieldErrors: { registry_links: ["x"] } } }), "Check your gift registry links.");
  assert.equal(describeSaveError(400, { error: "Validation failed", details: { fieldErrors: { design_url: ["x"] } } }), "Check the image link.");
  assert.equal(
    describeSaveError(400, { error: "Validation failed", details: { fieldErrors: { event_date: ["x"], rsvp_deadline: ["y"], title: ["z"] } } }),
    "Check the dates and times. Check the event name.",
  );
});

test("a 400 without details asks to check the highlighted fields", () => {
  assert.equal(describeSaveError(400, { error: "Validation failed" }), "Some details couldn't be saved. Check the highlighted fields.");
  assert.equal(describeSaveError(400, { error: "Validation failed", details: { fieldErrors: { unknown_key: ["x"] } } }), "Some details couldn't be saved. Check the highlighted fields.");
});

test("raw server strings are never shown; friendly ones pass through", () => {
  assert.equal(describeSaveError(500, { error: "Internal server error" }), "Couldn't save your changes.");
  assert.equal(describeSaveError(422, { error: "Validation failed" }), "Couldn't save your changes.");
  assert.equal(describeSaveError(429, { error: "Too many requests. Try again in a minute." }), "Too many requests. Try again in a minute.");
  assert.equal(describeSaveError(403, null), "Couldn't save your changes.");
});

test("a 5xx that never recovers fails with plain words, not the server string", async () => {
  const { queue } = queueWith(() => json(500, { error: "Internal server error" }));
  queue.enqueue(base, named);
  assert.deepEqual(await queue.flush(), { kind: "failed", message: "Couldn't save your changes." });
});

// ---- I1b: values the server would refuse are held on the client ----

test("image and media links must be https or an /uploads/ path", () => {
  assert.equal(checkLink(""), undefined);
  assert.equal(checkLink("https://example.com/a.png"), undefined);
  assert.equal(checkLink("/uploads/abc.png"), undefined);
  assert.equal(checkLink("http://example.com/a.png"), LINK_ERROR);
  assert.equal(checkLink("https:"), LINK_ERROR);
  assert.equal(checkLink("htt"), LINK_ERROR);
  assert.equal(checkLink("javascript:alert(1)"), LINK_ERROR);
  assert.match(checkLink(`https://example.com/${"a".repeat(600)}`) ?? "", /too long/);
});

test("gift registry links: https only, name up to 100, at most 10", () => {
  assert.equal(checkRegistryLink("Amazon", "https://amazon.ca/list", 0), undefined);
  assert.match(checkRegistryLink("Amazon", "http://amazon.ca/list", 0) ?? "", /https:\/\//);
  assert.match(checkRegistryLink("", "https://amazon.ca/list", 0) ?? "", /name/);
  assert.match(checkRegistryLink("a".repeat(101), "https://amazon.ca/list", 0) ?? "", /100 characters/);
  assert.match(checkRegistryLink("Amazon", "https://amazon.ca/list", 10) ?? "", /up to 10/);
  // Every link the check lets through is one the server takes.
  const links = Array.from({ length: 10 }, (_, i) => ({ label: `Shop ${i}`, url: `https://shop.example/${i}` }));
  assert.ok(eventUpdateSchema.safeParse({ registry_links: links }).success);
});

test("text over the schema caps is reported", () => {
  assert.deepEqual(textLimitErrors({ title: "a".repeat(200), location_name: "b".repeat(201), invitation_headline: "c".repeat(201) }), {
    location_name: "Keep this to 200 characters or fewer.",
    invitation_headline: "Keep this to 200 characters or fewer.",
  });
});

test("a cleared name on an existing draft is held with a plain message, not sent", () => {
  const r = resolveHeld(named, {}, { title: "" }, false, { holdBlankName: true });
  assert.deepEqual(r.send, {});
  assert.deepEqual(r.held, { title: "" });
  assert.equal(r.errors.title, DRAFT_NAME_ERROR);
  assert.equal(DRAFT_NAME_ERROR, "Add a name for your event.");
  assert.equal(basicsErrors({ ...named, title: "" }, r.held, { published: false, holdBlankName: true }).title, DRAFT_NAME_ERROR);
  // Typing a name releases it.
  const fixed = resolveHeld(named, r.held, { title: "New name" }, false, { holdBlankName: true });
  assert.deepEqual(fixed, { send: { title: "New name" }, held: {}, errors: {} });
});

test("before the draft exists a blank name is not held (nothing is being saved yet)", () => {
  const r = resolveHeld(base, {}, { title: "" }, false);
  assert.deepEqual(r, { send: { title: "" }, held: {}, errors: {} });
});

test("an over-long place is held on a draft while other fields still send", () => {
  const r = resolveHeld(named, {}, { location_name: "x".repeat(201), host_name: "Sam" }, false, { holdBlankName: true });
  assert.deepEqual(r.send, { host_name: "Sam" });
  assert.deepEqual(Object.keys(r.held), ["location_name"]);
});

// ---- Deadline rule matches readiness ----

test("an RSVP deadline equal to the start is flagged, as readiness does", () => {
  const d = { ...named, event_date: "2026-07-10T19:00", rsvp_deadline: "2026-07-10T19:00" };
  assert.equal(validateBasics(d, { published: false }).rsvp_deadline, "The RSVP deadline needs to be before the event.");
});

// ---- I2: a style never wipes media ----

test("applying a style keeps the uploaded logo, background image and music", () => {
  const current = {
    ...base.customization,
    logoUrl: "/uploads/logo.png",
    backgroundImage: "/uploads/bg.jpg",
    audioUrl: "/uploads/song.mp3",
    imageFit: "cover" as const,
  };
  const next = applyStyle(current, template.customization);
  assert.equal(next.logoUrl, "/uploads/logo.png");
  assert.equal(next.backgroundImage, "/uploads/bg.jpg");
  assert.equal(next.audioUrl, "/uploads/song.mp3");
  assert.equal(next.imageFit, "cover", "a style without framing keeps the host's framing");
  assert.equal(next.primaryColor, template.customization.primaryColor);
  assert.equal(next.backgroundColor, template.customization.backgroundColor);
  assert.equal(next.fontFamily, template.customization.fontFamily);
  assert.equal(next.buttonStyle, template.customization.buttonStyle);
  assert.equal(next.showCountdown, template.customization.showCountdown);
  assert.equal(applyStyle(current, { imagePosition: "top" }).imagePosition, "top");
});

test("a full upload space says so instead of blaming the file size", () => {
  assert.match(uploadFailureMessage(413), /^Your upload space is full\./);
  assert.match(uploadFailureMessage(400), /Try a smaller file/);
  assert.match(uploadFailureMessage(undefined), /Try a smaller file/);
});

// ---- I3: new drafts show the server's default questions ----

test("a new draft is seeded with the server's default questions without a save", async () => {
  let data: BuilderData = named;
  const enqueued: Array<[BuilderData, BuilderData]> = [];
  const seeded: BuilderRsvpField[][] = [];
  const defaults = toBuilderRsvpFields(DEFAULT_RSVP_FIELDS);
  const ensureDraft = createDraftCreator({
    post: async (body) => json(201, { ...body, ...named, customization: { ...named.customization, logoUrl: null, backgroundImage: null, audioUrl: null }, id: "e1" }),
    getData: () => data,
    organizationId: undefined,
    newDraftRsvpFields: defaults,
    queue: { enqueue: (prev, next) => { enqueued.push([prev, next]); } },
    now: () => 1,
    onCreated: (_id, fields) => {
      seeded.push(fields);
      // What the hook does: put them in the data, no save scheduled.
      data = { ...data, rsvp_fields: fields };
    },
    report: () => undefined,
  });
  assert.equal(await ensureDraft(), "e1");
  assert.equal(seeded.length, 1);
  assert.deepEqual(seeded[0].map((f) => f.field_name), DEFAULT_RSVP_FIELDS.map((f) => f.field_name));
  assert.ok(seeded[0].every((f) => f.is_enabled), "the switches show as on, like the server rows");
  assert.equal(enqueued.length, 1);
  const [baseline, current] = enqueued[0];
  assert.deepEqual(baseline.rsvp_fields, defaults, "the baseline holds the server's questions too");
  assert.deepEqual(current.rsvp_fields, defaults);
  assert.equal(toPatch(baseline, current), null, "seeding sends no PATCH");
});

test("the seeded questions match what fromEvent reads back from the server", () => {
  const rows = DEFAULT_RSVP_FIELDS.map((f, i) => ({ ...f, id: `r${i}`, event_id: "e1", sort_order: i, created_at: "" }));
  const read = fromEvent({ ...named, id: "e1" } as unknown as Event, rows as never);
  assert.deepEqual(read.rsvp_fields, toBuilderRsvpFields(DEFAULT_RSVP_FIELDS));
});
