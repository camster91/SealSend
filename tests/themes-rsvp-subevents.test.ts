import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openSqliteDb } from "../src/lib/db/sqlite-local";
import { sanitizeCustomization } from "../src/lib/sanitize";
import { eventDisplayFontFamily, eventFontFamily } from "../src/lib/event-font";
import { EVENT_TEMPLATES } from "../src/lib/event-templates";
import { eventCreateSchema, eventUpdateSchema, rsvpFieldSchema, rsvpSubmissionSchema } from "../src/lib/validations";
import { emptyBuilderData } from "../src/lib/event-builder/mapping";
import { perPersonRsvpFields, sanitizePlusOneAnswers, validatePlusOneAnswers } from "../src/lib/rsvp-fields";
import { buildRsvpSummary } from "../src/lib/rsvp-summary";
import { summarizeDietary } from "../src/lib/dietary-summary";
import { saveRsvp } from "../src/lib/rsvp-store";
import {
  createSubEvent,
  deleteSubEvent,
  listHostSubEvents,
  listVisibleSubEvents,
  saveSubEventRsvps,
  SubEventError,
  updateSubEvent,
} from "../src/lib/sub-events";
import type { RSVPField } from "../src/types/database";

const SCHEMA_SQL = readFileSync("src/lib/db/schema.sql", "utf8");
const MIGRATION_SQL = readFileSync("src/lib/db/migrations/2026-11-25-per-person-and-sub-events.sql", "utf8");

const HOST = "11111111-1111-4111-8111-1111111111aa";
const EVENT = "22222222-2222-4222-8222-2222222222aa";
const OTHER_EVENT = "22222222-2222-4222-8222-2222222222bb";
const G_VIP = "33333333-3333-4333-8333-3333333333a1";
const G_REG = "33333333-3333-4333-8333-3333333333a2";
const G_OTHER = "33333333-3333-4333-8333-3333333333a3";

async function seed() {
  const db = openSqliteDb(":memory:");
  await db.exec(SCHEMA_SQL);
  await db.query("INSERT INTO admin_users (id, email, password) VALUES ($1, 'h@test.example', 'x')", [HOST]);
  await db.query("INSERT INTO events (id, user_id, title, slug, status) VALUES ($1, $2, 'Wedding', 'wed-t', 'published')", [EVENT, HOST]);
  await db.query("INSERT INTO events (id, user_id, title, slug, status) VALUES ($1, $2, 'Other', 'other-t', 'published')", [OTHER_EVENT, HOST]);
  await db.query("INSERT INTO guests (id, event_id, name) VALUES ($1, $2, 'Vip'), ($3, $2, 'Reg')", [G_VIP, EVENT, G_REG]);
  await db.query("INSERT INTO guests (id, event_id, name) VALUES ($1, $2, 'Elsewhere')", [G_OTHER, OTHER_EVENT]);
  return db;
}

const field = (overrides: Partial<RSVPField>): RSVPField => ({
  id: overrides.field_name ?? "f",
  event_id: EVENT,
  field_name: "meal",
  field_label: "Meal",
  field_type: "select",
  options: ["Chicken", "Fish", "Veg"],
  placeholder: null,
  is_required: true,
  is_enabled: true,
  per_person: true,
  sort_order: 1,
  created_at: "",
  ...overrides,
});

test("themes: every template pairs fonts, a layout and a motif that survive sanitizing", () => {
  for (const template of EVENT_TEMPLATES) {
    const clean = sanitizeCustomization(template.customization as unknown as Record<string, unknown>);
    assert.equal(clean.layoutStyle, template.customization.layoutStyle ?? "classic", template.id);
    assert.equal(clean.motif, template.customization.motif ?? "none", template.id);
    assert.ok(eventDisplayFontFamily(clean.displayFont, clean.fontFamily).length > 0, template.id);
  }
  const hostile = sanitizeCustomization({ layoutStyle: "<script>", motif: "javascript:", displayFont: "Comic; } body{", fontFamily: "Inter" });
  assert.equal(hostile.layoutStyle, "classic");
  assert.equal(hostile.motif, "none");
  assert.doesNotMatch(eventDisplayFontFamily(hostile.displayFont, hostile.fontFamily), /[{};<]/);
  assert.equal(eventDisplayFontFamily(null, "Inter"), eventFontFamily("Inter"));
});

test("themes: event schema accepts new look fields, builder defaults (nullable), and rejects unknown layouts", () => {
  const ok = eventCreateSchema.safeParse({ title: "x", customization: { layoutStyle: "arch", motif: "botanical", displayFont: "Fraunces", themeId: "garden" } });
  assert.ok(ok.success);
  const fromBuilder = emptyBuilderData("UTC");
  assert.ok(eventCreateSchema.safeParse({ title: "Builder draft", customization: fromBuilder.customization }).success);
  assert.ok(eventUpdateSchema.safeParse({ customization: fromBuilder.customization }).success);
  assert.equal(eventCreateSchema.safeParse({ title: "x", customization: { layoutStyle: "carousel" } }).success, false);
});

test("per-person: only enabled custom fields marked per_person apply, and answers are validated per guest", () => {
  const fields = [
    field({ field_name: "meal" }),
    field({ field_name: "dietary", field_type: "text", options: null, is_required: false }),
    field({ field_name: "song", field_type: "text", options: null, per_person: false }),
    field({ field_name: "headcount", field_type: "number", options: null, per_person: true }),
  ];
  assert.deepEqual(perPersonRsvpFields(fields).map((f) => f.field_name), ["meal", "dietary"]);
  assert.deepEqual(sanitizePlusOneAnswers(fields, { meal: "Fish", song: "x", evil: 1 }), { meal: "Fish" });

  const bad = validatePlusOneAnswers(fields, [{ name: "Kim", answers: { meal: "Steak" } }, { name: "", answers: {} }]);
  assert.equal(bad.valid, false);
  if (!bad.valid) {
    assert.match(bad.errors["plus_ones.0.meal"], /^Kim: .*invalid option/);
    assert.match(bad.errors["plus_ones.1.meal"], /^Guest 2: .*required/);
  }
  assert.deepEqual(validatePlusOneAnswers(fields, [{ name: "Kim", answers: { meal: "Fish" } }]), { valid: true });
  // A historical choice the host later removed stays valid on edit.
  assert.deepEqual(validatePlusOneAnswers(fields, [{ name: "Kim", answers: { meal: "Beef" } }], [{ name: "Kim", answers: { meal: "Beef" } }]), { valid: true });
  // No per_person fields means no extra requirements at all.
  assert.deepEqual(validatePlusOneAnswers([field({ per_person: false })], [{ name: "Kim" }]), { valid: true });
  assert.ok(rsvpFieldSchema.parse({ field_name: "m", field_label: "M", field_type: "text" }).per_person === false);
});

test("per-person: answers persist on plus_ones, and summary, dietary and CSV counts include the whole party", async () => {
  const db = await seed();
  await db.query(
    "INSERT INTO rsvp_fields (event_id, field_name, field_type, field_label, is_required, is_enabled, per_person, options) VALUES ($1, 'meal', 'select', 'Meal', 1, 1, 1, $2)",
    [EVENT, ["Chicken", "Fish"]],
  );
  const input = rsvpSubmissionSchema.parse({
    respondent_name: "Ana",
    status: "attending",
    headcount: 3,
    response_data: { meal: "Chicken", dietary: "Nut allergy" },
    plus_ones: [
      { name: "Ben", answers: { meal: "Fish", dietary: "Vegan" } },
      { name: "Cy", answers: { meal: "Fish" } },
    ],
  });
  const { response } = await saveRsvp(db, EVENT, G_VIP, undefined, input, null);
  const stored = await db.query<{ name: string; answers: Record<string, unknown> }>(
    "SELECT name, answers FROM plus_ones WHERE rsvp_response_id = $1 ORDER BY name",
    [response.id],
  );
  assert.deepEqual(stored.map((p) => [p.name, p.answers.meal]), [["Ben", "Fish"], ["Cy", "Fish"]]);
  assert.deepEqual(response.plus_ones_data[0].answers, { meal: "Fish", dietary: "Vegan" });

  const responses = await db.query<{ id: string; status: string; headcount: number; response_data: Record<string, unknown>; plus_ones_data: [] }>(
    "SELECT id, status, headcount, response_data, plus_ones_data FROM rsvp_responses WHERE event_id = $1",
    [EVENT],
  );
  const fields = await db.query<{ field_name: string; field_label: string; field_type: string; is_required: boolean; per_person: boolean; options: string[] }>(
    "SELECT field_name, field_label, field_type, is_required, per_person, options FROM rsvp_fields WHERE event_id = $1",
    [EVENT],
  );
  assert.equal(fields[0].per_person, true);
  const summary = buildRsvpSummary(responses, fields, null);
  assert.deepEqual(summary.fields[0].counts, [{ value: "Fish", count: 2 }, { value: "Chicken", count: 1 }]);
  assert.equal(summary.attendingHeadcount, 3);
  assert.deepEqual(
    summarizeDietary(responses).map((n) => n.note).sort(),
    ["Nut allergy", "Vegan"],
  );
});

test("migration: upgrades a pre-feature database to the same tables and columns as schema.sql", async () => {
  const oldSchema = SCHEMA_SQL
    .replace(/^\s*per_person BOOLEAN DEFAULT 0,\r?\n/m, "")
    .replace(/^\s*answers JSON_TEXT NOT NULL DEFAULT '\{\}',\r?\n/m, "")
    .replace(/-- =+\r?\n-- OPTIONAL SUB-EVENTS[\s\S]*?idx_sub_event_rsvps_response ON sub_event_rsvps \(rsvp_response_id\);/, "");
  assert.notEqual(oldSchema, SCHEMA_SQL);
  const legacy = openSqliteDb(":memory:");
  await legacy.exec(oldSchema);
  assert.equal((await legacy.query("SELECT name FROM sqlite_master WHERE name = 'event_sub_events'")).length, 0);
  await legacy.exec(MIGRATION_SQL);
  const fresh = openSqliteDb(":memory:");
  await fresh.exec(SCHEMA_SQL);

  const shape = async (db: typeof fresh) => {
    const tables = await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const cols: Record<string, string[]> = {};
    for (const table of ["rsvp_fields", "plus_ones", "event_sub_events", "sub_event_guests", "sub_event_rsvps"]) {
      cols[table] = (await db.query<{ name: string; type: string }>(`SELECT name, type FROM pragma_table_info('${table}') ORDER BY name`)).map((c) => `${c.name}:${c.type}`);
    }
    return { tables: tables.map((t) => t.name), cols };
  };
  assert.deepEqual(await shape(legacy), await shape(fresh));
});

test("sub-events: invited-only parts stay hidden and unwritable for everyone not invited", async () => {
  const db = await seed();
  const all = await createSubEvent(db, EVENT, { title: "Ceremony", visibility: "all", sort_order: 0 });
  // A guest from another event must never be attached, even if their id is supplied.
  const vip = await createSubEvent(db, EVENT, { title: "Rehearsal dinner", visibility: "invited_only", sort_order: 1, invited_guest_ids: [G_VIP, G_OTHER] });
  assert.deepEqual(vip.invited_guest_ids, [G_VIP]);

  assert.deepEqual((await listVisibleSubEvents(db, EVENT, null, null)).map((s) => s.title), ["Ceremony"]);
  assert.deepEqual((await listVisibleSubEvents(db, EVENT, G_REG, null)).map((s) => s.title), ["Ceremony"]);
  assert.deepEqual((await listVisibleSubEvents(db, EVENT, G_VIP, null)).map((s) => s.title), ["Ceremony", "Rehearsal dinner"]);
  assert.deepEqual(await listVisibleSubEvents(db, OTHER_EVENT, G_VIP, null), []);

  const regRsvp = "44444444-4444-4444-8444-4444444444a2";
  const vipRsvp = "44444444-4444-4444-8444-4444444444a1";
  const publicRsvp = "44444444-4444-4444-8444-4444444444a3";
  await db.query(
    `INSERT INTO rsvp_responses (id, event_id, guest_id, respondent_name, status, headcount) VALUES
      ($1, $4, $5, 'Reg', 'attending', 1), ($2, $4, $6, 'Vip', 'attending', 2), ($3, $4, NULL, 'Pub', 'attending', 1)`,
    [regRsvp, vipRsvp, publicRsvp, EVENT, G_REG, G_VIP],
  );

  // Uninvited guest and public reply both get 403 and nothing is written (whole batch rolls back).
  for (const [rsvpId, guestId] of [[regRsvp, G_REG], [publicRsvp, null]] as const) {
    await assert.rejects(
      saveSubEventRsvps(db, EVENT, rsvpId, guestId, 1, [
        { sub_event_id: all.id, status: "attending" },
        { sub_event_id: vip.id, status: "attending" },
      ]),
      (error: unknown) => error instanceof SubEventError && error.status === 403,
    );
  }
  assert.equal((await db.query("SELECT 1 FROM sub_event_rsvps")).length, 0);

  // A response id from the wrong event is refused.
  await assert.rejects(saveSubEventRsvps(db, OTHER_EVENT, vipRsvp, G_VIP, 1, [{ sub_event_id: all.id, status: "attending" }]), SubEventError);

  const saved = await saveSubEventRsvps(db, EVENT, vipRsvp, G_VIP, 2, [
    { sub_event_id: all.id, status: "attending" },
    { sub_event_id: vip.id, status: "maybe" },
  ]);
  assert.deepEqual(saved.map((s) => [s.title, s.my_status, s.my_headcount]), [["Ceremony", "attending", 2], ["Rehearsal dinner", "maybe", 2]]);
  // Retrying the same answer is idempotent (upsert, not a second row).
  await saveSubEventRsvps(db, EVENT, vipRsvp, G_VIP, 2, [{ sub_event_id: all.id, status: "attending" }]);
  const host = await listHostSubEvents(db, EVENT);
  assert.deepEqual(host.map((s) => [s.title, s.attending_headcount, s.maybe_count]), [["Ceremony", 2, 0], ["Rehearsal dinner", 0, 1]]);

  // Revoking the invitation hides the part again.
  await updateSubEvent(db, EVENT, vip.id, { invited_guest_ids: [] });
  assert.deepEqual((await listVisibleSubEvents(db, EVENT, G_VIP, vipRsvp)).map((s) => s.title), ["Ceremony"]);
  // A host can't edit or delete another event's sub-event by swapping ids.
  assert.equal(await updateSubEvent(db, OTHER_EVENT, vip.id, { title: "Hijack" }), null);
  assert.equal(await deleteSubEvent(db, OTHER_EVENT, vip.id), false);
});

test("sub-events: deleting a reply, a guest or the event cascades cleanly", async () => {
  const db = await seed();
  const part = await createSubEvent(db, EVENT, { title: "Brunch", visibility: "invited_only", sort_order: 0, invited_guest_ids: [G_VIP] });
  const rsvp = "44444444-4444-4444-8444-4444444444b1";
  await db.query("INSERT INTO rsvp_responses (id, event_id, guest_id, respondent_name, status) VALUES ($1, $2, $3, 'Vip', 'attending')", [rsvp, EVENT, G_VIP]);
  await saveSubEventRsvps(db, EVENT, rsvp, G_VIP, 1, [{ sub_event_id: part.id, status: "attending" }]);

  await db.query("DELETE FROM rsvp_responses WHERE id = $1", [rsvp]);
  assert.equal((await db.query("SELECT 1 FROM sub_event_rsvps")).length, 0);
  await db.query("DELETE FROM guests WHERE id = $1", [G_VIP]);
  assert.equal((await db.query("SELECT 1 FROM sub_event_guests")).length, 0);
  await db.query("DELETE FROM events WHERE id = $1", [EVENT]);
  assert.equal((await db.query("SELECT 1 FROM event_sub_events")).length, 0);
});
