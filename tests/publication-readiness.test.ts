import assert from "node:assert/strict";
import test from "node:test";

import { getPublicationReadiness } from "../src/lib/publication-readiness";

test("publication readiness lists the three things a host must add", () => {
  const result = getPublicationReadiness({
    title: " ",
    event_date: null,
    event_end_date: null,
    location_name: "",
    max_attendees: null,
    invitation_headline: null,
    invitation_body: " ",
    rsvp_deadline: null,
    event_brief: null,
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers.map((blocker) => blocker.field), [
    "title",
    "event_date",
    "location_name",
  ]);
});

test("capacity, brief and invitation copy no longer block publishing", () => {
  const result = getPublicationReadiness({
    title: "Dinner",
    event_date: "2026-09-18T22:00:00.000Z",
    location_name: "Hall",
    max_attendees: null,
    event_brief: null,
    invitation_headline: null,
    invitation_body: null,
  });

  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test("publication readiness rejects invalid schedule ordering", () => {
  const result = getPublicationReadiness({
    title: "Community dinner",
    event_date: "2026-09-18T22:00:00.000Z",
    event_end_date: "2026-09-18T21:00:00.000Z",
    location_name: "Community Hall",
    max_attendees: 60,
    invitation_headline: "Join our September dinner",
    invitation_body: "Please review the details and RSVP.",
    rsvp_deadline: "2026-09-19T22:00:00.000Z",
    event_brief: {
      audience: "Neighbourhood volunteers",
      accessibilityStatus: "no_known_requirements",
      accessibilityNotes: null,
      communicationPreference: "email",
    },
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers.map((blocker) => blocker.field), [
    "event_end_date",
    "rsvp_deadline",
  ]);
});

test("publication readiness accepts a complete reviewed event", () => {
  const result = getPublicationReadiness({
    title: "Community dinner",
    event_date: new Date("2026-09-18T22:00:00.000Z"),
    event_end_date: new Date("2026-09-19T01:00:00.000Z"),
    location_name: "Community Hall",
    max_attendees: 60,
    invitation_headline: "Join our September dinner",
    invitation_body: "Please review the details and RSVP.",
    rsvp_deadline: new Date("2026-09-15T22:00:00.000Z"),
    event_brief: {
      audience: "Neighbourhood volunteers",
      accessibilityStatus: "requirements_known",
      accessibilityNotes: "Step-free entrance is available.",
      communicationPreference: "email_and_sms",
    },
  });

  assert.deepEqual(result, { ready: true, blockers: [] });
});
