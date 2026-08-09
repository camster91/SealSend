import test from "node:test";
import assert from "node:assert/strict";
import { instantToZonedLocalDateTime, zonedLocalDateTimeToInstant } from "../src/lib/datetime";

test("converts selected wall-clock time using the event timezone", () => {
  assert.equal(zonedLocalDateTimeToInstant("2026-07-10T19:00", "America/Toronto"), "2026-07-10T23:00:00.000Z");
  assert.equal(instantToZonedLocalDateTime("2026-07-10T23:00:00.000Z", "America/Toronto"), "2026-07-10T19:00");
});

test("rejects nonexistent daylight-saving wall-clock times", () => {
  assert.throws(() => zonedLocalDateTimeToInstant("2026-03-08T02:30", "America/Toronto"), /daylight-saving/i);
});

test("chooses the first occurrence for an ambiguous fall-back time", () => {
  assert.equal(zonedLocalDateTimeToInstant("2026-11-01T01:30", "America/Toronto"), "2026-11-01T05:30:00.000Z");
});
