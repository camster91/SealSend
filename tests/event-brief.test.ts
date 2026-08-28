import assert from "node:assert/strict";
import test from "node:test";

import { buildFallbackEventDraft } from "../src/lib/ai/fallback";
import {
  applyEventBriefToDraft,
  getEventBriefContext,
  parseEventBrief,
} from "../src/lib/event-brief";

const completeBrief = {
  summary: "A monthly community dinner for neighbourhood volunteers.",
  eventDate: "2026-09-18T22:00:00.000Z",
  locationName: "Community Hall",
  maxAttendees: 60,
  audience: "Neighbourhood volunteers and their invited household members",
  accessibilityStatus: "requirements_known" as const,
  accessibilityNotes: "Step-free entrance and a quiet seating area are available.",
  communicationPreference: "email_and_sms" as const,
};

test("event brief requires explicit audience, accessibility review, and communication intent", () => {
  assert.throws(
    () => parseEventBrief({
      ...completeBrief,
      audience: " ",
      accessibilityStatus: "not_reviewed",
      communicationPreference: "undecided",
    }),
    /audience|review|communication/i,
  );
});

test("known accessibility requirements require usable notes", () => {
  assert.throws(
    () => parseEventBrief({ ...completeBrief, accessibilityNotes: " " }),
    /accessibility/i,
  );
});

test("event brief context excludes schedule fields that already have canonical event columns", () => {
  const context = getEventBriefContext(parseEventBrief(completeBrief));

  assert.deepEqual(context, {
    audience: completeBrief.audience,
    accessibilityStatus: completeBrief.accessibilityStatus,
    accessibilityNotes: completeBrief.accessibilityNotes,
    communicationPreference: completeBrief.communicationPreference,
  });
  assert.equal("eventDate" in context, false);
  assert.equal("locationName" in context, false);
  assert.equal("maxAttendees" in context, false);
});

test("structured schedule, location, and capacity override an AI draft and clear missing disclosures", () => {
  const fallback = buildFallbackEventDraft(
    "A monthly community dinner for neighbourhood volunteers.",
    "America/Toronto",
  );
  const result = applyEventBriefToDraft(fallback, parseEventBrief(completeBrief));

  assert.equal(result.event.eventDate, completeBrief.eventDate);
  assert.equal(result.event.locationName, completeBrief.locationName);
  assert.equal(result.event.maxAttendees, completeBrief.maxAttendees);
  assert.equal(result.missingInformation.includes("event.eventDate"), false);
  assert.equal(result.missingInformation.includes("event.locationName"), false);
  assert.equal(result.missingInformation.includes("event.maxAttendees"), false);
});
