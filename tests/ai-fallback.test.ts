import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { buildFallbackEventDraft } from "../src/lib/ai/fallback";
import { aiEventDraftSchema, parseAiEventDraft } from "../src/lib/ai/event-draft-schema";
import { aiAnnouncementDraftSchema } from "../src/lib/ai/announcement-draft-schema";

test("fallback remains a valid editable draft and discloses missing facts", () => {
  const draft = buildFallbackEventDraft("Client appreciation dinner for 40 people. Business casual.", "America/Toronto");
  assert.doesNotThrow(() => parseAiEventDraft(draft));
  assert.equal(draft.event.maxAttendees, 40);
  assert.equal(draft.event.eventDate, null);
  assert.equal(draft.event.locationName, null);
  assert.ok(draft.assumptions.every((item) => item.requiresConfirmation));
});

test("announcement copilot contract rejects invented extra fields", () => {
  assert.equal(aiAnnouncementDraftSchema.safeParse({ subject: "Update", message: "Details", cautions: [], sendNow: true }).success, false);
  assert.equal(aiAnnouncementDraftSchema.safeParse({ subject: "Update", message: "Details", cautions: [] }).success, true);
});

test("AI contract can be exported as a strict provider JSON schema", () => {
  const schema = z.toJSONSchema(aiEventDraftSchema) as Record<string, unknown>;
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
});
