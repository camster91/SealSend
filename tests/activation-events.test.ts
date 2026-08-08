import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActivationEvent,
  recordActivationEvent,
  recordActivationEventSafely,
} from "../src/lib/analytics/activation-events";

test("keeps only approved non-personal activation metadata", () => {
  const event = buildActivationEvent({
    name: "event_published",
    userId: "7a7c1f66-48a8-44f6-a268-07ea1fe77b24",
    eventId: "e24c215f-9b71-4bf5-b65d-f807a50f5d52",
    metadata: {
      source: "manual",
      plan: "free",
      email: "private@example.com",
      guestName: "Private Person",
      message: "private message body",
    },
  });

  assert.deepEqual(event.metadata, { source: "manual", plan: "free" });
  assert.equal(JSON.stringify(event).includes("private@example.com"), false);
  assert.equal(JSON.stringify(event).includes("Private Person"), false);
  assert.equal(JSON.stringify(event).includes("private message body"), false);
});

test("analytics failures never break the product workflow", async () => {
  const recorded = await recordActivationEventSafely(
    { name: "event_draft_started" },
    async () => {
      throw new Error("analytics database unavailable");
    },
  );

  assert.equal(recorded, false);
});

test("rejects unknown event names instead of creating ungoverned telemetry", () => {
  assert.throws(
    () => buildActivationEvent({ name: "page_view" as "event_published" }),
    /activation event/i,
  );
});

test("records a sanitized activation event without making callers construct SQL", async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];

  await recordActivationEvent(
    {
      name: "first_rsvp_received",
      eventId: "e24c215f-9b71-4bf5-b65d-f807a50f5d52",
      metadata: { source: "public_event", respondentEmail: "private@example.com" },
    },
    async (sql, params) => {
      calls.push({ sql, params });
      return [];
    },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO activation_events/);
  assert.match(calls[0].sql, /ON CONFLICT DO NOTHING/);
  assert.deepEqual(calls[0].params?.slice(0, 3), [
    "first_rsvp_received",
    null,
    "e24c215f-9b71-4bf5-b65d-f807a50f5d52",
  ]);
  assert.deepEqual(JSON.parse(String(calls[0].params?.[3])), { source: "public_event" });
});
