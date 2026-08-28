import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  AI_EVENT_DRAFT_SCHEMA_VERSION,
  aiEventDraftSchema,
  parseAiEventDraft,
} from "../src/lib/ai/event-draft-schema";

test("capacity disclosure ships as event draft contract 1.1", () => {
  assert.equal(AI_EVENT_DRAFT_SCHEMA_VERSION, "1.1");
});

const validDraft = {
  schemaVersion: "1.1",
  event: {
    title: "Client Appreciation Dinner",
    description: "An evening to thank our clients.",
    eventDate: null,
    eventEndDate: null,
    eventTimezone: "America/Toronto",
    locationName: null,
    locationAddress: null,
    hostName: null,
    dressCode: "Business casual",
    rsvpDeadline: null,
    maxAttendees: 40,
    allowPlusOnes: false,
    maxGuestsPerRsvp: 1,
  },
  rsvpFields: [
    {
      key: "dietary_requirements",
      label: "Do you have any dietary requirements?",
      type: "text",
      required: false,
      options: [],
    },
  ],
  invitation: {
    headline: "An evening of appreciation",
    body: "Please join us for a client appreciation dinner.",
    tone: "professional",
  },
  reminders: [],
  theme: {
    style: "modern",
    primaryColor: "#1E3A5F",
    backgroundColor: "#F8FAFC",
    imageDirection: "Refined dinner setting with no embedded text.",
  },
  missingInformation: ["event.eventDate", "event.locationName"],
  assumptions: [
    {
      field: "event.allowPlusOnes",
      value: "false",
      reason: "The host did not mention plus-ones.",
      requiresConfirmation: true,
    },
  ],
};

test("accepts a versioned event draft with explicit missing information", () => {
  const result = parseAiEventDraft(validDraft);

  assert.equal(result.schemaVersion, AI_EVENT_DRAFT_SCHEMA_VERSION);
  assert.equal(result.event.eventDate, null);
  assert.deepEqual(result.missingInformation, [
    "event.eventDate",
    "event.locationName",
  ]);
});

test("rejects an unlisted unknown field so model output cannot bypass the contract", () => {
  assert.throws(
    () => parseAiEventDraft({ ...validDraft, inventedPolicy: "Guests must pay $50" }),
    /unrecognized|unrecognized key/i,
  );
});

test("rejects a missing date that is not disclosed to the host", () => {
  assert.throws(
    () => parseAiEventDraft({ ...validDraft, missingInformation: ["event.locationName"] }),
    /event\.eventDate/,
  );
});

test("rejects a missing location that is not disclosed to the host", () => {
  assert.throws(
    () => parseAiEventDraft({ ...validDraft, missingInformation: ["event.eventDate"] }),
    /event\.locationName/,
  );
});

test("rejects a missing capacity that is not disclosed to the host", () => {
  assert.throws(
    () => parseAiEventDraft({
      ...validDraft,
      event: { ...validDraft.event, maxAttendees: null },
    }),
    /event\.maxAttendees/,
  );
});

test("rejects invalid timezones and non-ISO event instants", () => {
  assert.throws(
    () => parseAiEventDraft({
      ...validDraft,
      event: {
        ...validDraft.event,
        eventDate: "September 18 at seven",
        eventTimezone: "Toronto time",
      },
      missingInformation: ["event.locationName"],
    }),
    /date|timezone/i,
  );
});

test("rejects RSVP options for a free-text question", () => {
  assert.throws(
    () => parseAiEventDraft({
      ...validDraft,
      rsvpFields: [{
        ...validDraft.rsvpFields[0],
        options: ["Vegetarian"],
      }],
    }),
    /options/i,
  );
});

test("the evaluation set contains ten named scenarios with expected outcomes", () => {
  const fixturePath = join(process.cwd(), "tests", "fixtures", "ai-event-drafts.json");
  const fixtures = JSON.parse(readFileSync(fixturePath, "utf8")) as Array<{
    id: string;
    category: string;
    expectedValid: boolean;
    output: unknown;
  }>;

  assert.equal(fixtures.length, 10);
  assert.equal(new Set(fixtures.map((fixture) => fixture.id)).size, 10);
  assert.deepEqual(
    new Set(fixtures.map((fixture) => fixture.category)),
    new Set([
      "wedding",
      "business",
      "community",
      "birthday",
      "ambiguous-date",
      "international-contact",
      "dst-boundary",
      "malformed-output",
      "missing-disclosure",
      "unsafe-extra-field",
    ]),
  );

  for (const fixture of fixtures) {
    const result = aiEventDraftSchema.safeParse(fixture.output);
    assert.equal(result.success, fixture.expectedValid, fixture.id);
  }
});
