import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RSVP_FIELDS } from "../src/lib/constants";
import { eventCreateSchema, eventUpdateSchema, rsvpFieldSchema } from "../src/lib/validations";
import { aiFieldTypeToRsvpFieldType, wizardSubmitStatus } from "../src/lib/wizard-submit";

test("every default RSVP field passes the server's RSVP field check", () => {
  for (const [index, field] of DEFAULT_RSVP_FIELDS.entries()) {
    const parsed = rsvpFieldSchema.safeParse(field);
    assert.ok(parsed.success, `default field ${index} (${field.field_name}, ${field.field_type}) must be accepted`);
  }
});

test("AI-drafted field types map to types the server accepts", () => {
  for (const type of ["text", "email", "phone", "number", "select", "multiselect", "textarea", "attendance"]) {
    const mapped = aiFieldTypeToRsvpFieldType(type);
    const parsed = rsvpFieldSchema.safeParse({ field_name: "f", field_label: "F", field_type: mapped });
    assert.ok(parsed.success, `AI type ${type} -> ${mapped} must be accepted`);
  }
  assert.equal(aiFieldTypeToRsvpFieldType("phone"), "phone");
});

test("the design step's 'paste a URL' mode is a valid design type on create and edit", () => {
  assert.ok(eventCreateSchema.safeParse({ title: "Party", design_type: "url", design_url: "https://example.com/a.png" }).success);
  assert.ok(eventUpdateSchema.safeParse({ design_type: "url" }).success);
});

test("saving an edit never unpublishes; create defaults to draft", () => {
  assert.equal(wizardSubmitStatus("edit", false), undefined);
  assert.equal(wizardSubmitStatus("edit", true), "published");
  assert.equal(wizardSubmitStatus("create", false), "draft");
  assert.equal(wizardSubmitStatus("create", true), "published");
});
