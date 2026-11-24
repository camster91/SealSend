import assert from "node:assert/strict";
import test from "node:test";

import { buildFirstEventChecklist } from "../src/lib/onboarding-checklist";

const event = { id: "event-1", eventDate: "2026-09-18T22:00:00.000Z", locationName: "Community Hall", status: "draft" as const };

test("a draft shows the four steps left, with links to finish them", () => {
  const steps = buildFirstEventChecklist({ event: { ...event, eventDate: null, locationName: "  " }, hasGuest: false });
  assert.deepEqual(steps.map(({ label, complete, href }) => ({ label, complete, href })), [
    { label: "Create an event", complete: true, href: "/events/event-1/edit" },
    { label: "Set the date and place", complete: false, href: "/events/event-1/edit" },
    { label: "Add your first guest", complete: false, href: "/events/event-1/guests" },
    { label: "Publish the event", complete: false, href: "/events/event-1" },
  ]);
});

test("a published event with guests is complete without a capacity limit", () => {
  assert.ok(buildFirstEventChecklist({ event: { ...event, status: "published" }, hasGuest: true }).every((step) => step.complete));
});

test("a date without a place is not complete", () => {
  const steps = buildFirstEventChecklist({ event: { ...event, locationName: null }, hasGuest: false });
  assert.equal(steps.find((step) => step.label === "Set the date and place")?.complete, false);
});

test("a new host gets create-event links without fabricated progress", () => {
  const steps = buildFirstEventChecklist({ event: null, hasGuest: false });
  assert.equal(steps.filter((step) => step.complete).length, 0);
  assert.equal(steps.every((step) => step.href === "/events/new"), true);
});
