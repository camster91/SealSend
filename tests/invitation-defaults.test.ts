import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { defaultInvitationCopy, withDefaultInvitationCopy } from "../src/lib/invitation-defaults";

test("headline is You're invited: {title}", () => {
  assert.equal(defaultInvitationCopy({ title: "Volunteer dinner" }).headline, "You're invited: Volunteer dinner");
});

test("body names host, date and place when known", () => {
  const { body } = defaultInvitationCopy({
    title: "Volunteer dinner",
    host_name: "Riverside Volunteers",
    event_date: "2026-09-20T22:00:00Z",
    event_timezone: "America/Toronto",
    location_name: "Community Hall",
  });
  for (const part of ["Riverside Volunteers", "September 20", "6:00 PM", "Community Hall"]) {
    assert.ok(body.includes(part), `body should include ${part}: ${body}`);
  }
});

test("body still reads well with only a title", () => {
  const { body } = defaultInvitationCopy({ title: "Dinner", event_date: "not a date", event_timezone: "Nowhere/Land" });
  assert.ok(body.length > 0);
  assert.doesNotMatch(body, /undefined|null|Invalid/);
});

test("withDefaultInvitationCopy never overwrites host text", () => {
  const result = withDefaultInvitationCopy({ title: "Dinner", invitation_headline: "Come!", invitation_body: "  " });
  assert.equal(result.invitation_headline, "Come!");
  assert.ok(result.invitation_body && result.invitation_body.trim().length > 0);
});

test("every route that publishes fills blank copy", () => {
  for (const file of [
    "src/app/api/events/[eventId]/publish/route.ts",
    "src/app/api/events/[eventId]/route.ts",
    "src/app/api/events/route.ts",
  ]) {
    assert.ok(readFileSync(file, "utf8").includes("withDefaultInvitationCopy("), file);
  }
});
