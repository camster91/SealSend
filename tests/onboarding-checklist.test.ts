import assert from "node:assert/strict";
import test from "node:test";

import { buildFirstEventChecklist } from "../src/lib/onboarding-checklist";

test("an event draft is not guest-ready until its schedule, location, and invitation copy exist", () => {
  const steps = buildFirstEventChecklist({
    event: {
      id: "event-1",
      eventDate: null,
      locationName: "  ",
      invitationHeadline: "Welcome",
      invitationBody: " ",
      status: "draft",
    },
    hasGuest: false,
    hasInvitation: false,
  });

  assert.deepEqual(
    steps.map(({ label, complete, href }) => ({ label, complete, href })),
    [
      { label: "Create an event", complete: true, href: "/events/event-1/edit" },
      { label: "Confirm date and location", complete: false, href: "/events/event-1/edit" },
      { label: "Review invitation copy", complete: false, href: "/events/event-1/edit" },
      { label: "Add your first guest", complete: false, href: "/events/event-1/guests" },
      { label: "Publish the event", complete: false, href: "/events/event-1" },
      { label: "Send the first invitation", complete: false, href: "/events/event-1/guests" },
    ],
  );
});

test("the checklist reports the complete first-event workflow only from real state", () => {
  const steps = buildFirstEventChecklist({
    event: {
      id: "event-2",
      eventDate: "2026-09-18T22:00:00.000Z",
      locationName: "Community Hall",
      invitationHeadline: "September gathering",
      invitationBody: "Please review the details and RSVP.",
      status: "published",
    },
    hasGuest: true,
    hasInvitation: true,
  });

  assert.equal(steps.length, 6);
  assert.equal(steps.every((step) => step.complete), true);
});

test("a new host gets actionable create-event links without fabricated progress", () => {
  const steps = buildFirstEventChecklist({ event: null, hasGuest: false, hasInvitation: false });

  assert.equal(steps.filter((step) => step.complete).length, 0);
  assert.equal(steps.every((step) => step.href === "/events/new"), true);
});
