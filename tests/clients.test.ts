import assert from "node:assert/strict";
import test from "node:test";

import { clientInputSchema, toClientShareView } from "../src/lib/clients";

test("client records need a name and validate contact details", () => {
  assert.equal(clientInputSchema.safeParse({ name: "" }).success, false);
  assert.equal(clientInputSchema.safeParse({ name: "Ana", contactEmail: "nope" }).success, false);
  assert.equal(clientInputSchema.safeParse({ name: "Ana", extra: true }).success, false);
  const parsed = clientInputSchema.parse({ name: "  Ana & Co ", contactEmail: "", contactPhone: " ", notes: "Prefers texts" });
  assert.deepEqual(parsed, { name: "Ana & Co", contactEmail: null, contactPhone: null, notes: "Prefers texts" });
});

test("the client view exposes RSVP totals only, never guest details", () => {
  const view = toClientShareView({
    share_id: "s1", event_id: "e1", title: "Gala", event_date: null, event_timezone: "UTC",
    location_name: "Hall", host_name: "Bloom", invitation_headline: "Join us", invitation_body: null,
    design_url: null, status: "published", client_name: "Ana", approved_at: null, approver_name: null,
    expires_at: "2026-10-25T00:00:00Z", invited: "10", attending: "4", maybe: "1", declined: "2", headcount: "7",
  });
  assert.deepEqual(view.rsvp, { invited: 10, attending: 4, maybe: 1, declined: 2, awaiting: 3, headcount: 7 });
  const keys = JSON.stringify(view);
  assert.doesNotMatch(keys, /email|phone|guest_name|respondent/i);
});

test("awaiting replies never goes negative when responses outnumber listed guests", () => {
  const view = toClientShareView({
    share_id: "s1", event_id: "e1", title: "Open RSVP", event_date: null, event_timezone: "UTC",
    location_name: null, host_name: null, invitation_headline: null, invitation_body: null,
    design_url: null, status: "published", client_name: null, approved_at: null, approver_name: null,
    expires_at: "2026-10-25T00:00:00Z", invited: "0", attending: "5", maybe: "0", declined: "0", headcount: "5",
  });
  assert.equal(view.rsvp.awaiting, 0);
});
