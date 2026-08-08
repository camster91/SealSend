import test from "node:test";
import assert from "node:assert/strict";
import { messageAudienceSchema, buildAudienceQuery } from "../src/lib/messages/audience";

test("accepts explicit audience filters and normalizes empty selections", () => {
  const audience = messageAudienceSchema.parse({
    rsvpStatuses: ["attending", "pending"],
    invitationStatuses: ["sent"],
    tagIds: ["6d92a14d-b8ef-448c-9ef6-a97a93e4de23"],
    unansweredOnly: true,
  });
  assert.equal(audience.unansweredOnly, true);
  assert.equal(audience.tagIds.length, 1);
});

test("builds a parameterized event-scoped audience query", () => {
  const result = buildAudienceQuery("event-id", {
    rsvpStatuses: ["attending"], invitationStatuses: ["sent"], tagIds: [], unansweredOnly: false,
  });
  assert.match(result.sql, /g\.event_id = \$1/);
  assert.match(result.sql, /g\.rsvp_status = ANY\(\$2::text\[\]\)/);
  assert.match(result.sql, /g\.invite_status = ANY\(\$3::text\[\]\)/);
  assert.doesNotMatch(result.sql, /attending|sent/);
  assert.deepEqual(result.params, ["event-id", ["attending"], ["sent"]]);
});

test("unanswered means no RSVP response rather than trusting a display flag", () => {
  const result = buildAudienceQuery("event-id", {
    rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: true,
  });
  assert.match(result.sql, /NOT EXISTS[\s\S]*rsvp_responses/);
});
