import assert from "node:assert/strict";
import test from "node:test";

import { resolveStaleDraftPolicy } from "../src/lib/retention";

test("stale-draft policy preserves a complete warning interval", () => {
  assert.deepEqual(resolveStaleDraftPolicy("90", "14"), {
    retentionDays: 90,
    warningDays: 14,
    warningAgeDays: 76,
  });
  assert.deepEqual(resolveStaleDraftPolicy("10", "50"), {
    retentionDays: 30,
    warningDays: 29,
    warningAgeDays: 1,
  });
  assert.deepEqual(resolveStaleDraftPolicy("invalid", "invalid"), {
    retentionDays: 90,
    warningDays: 14,
    warningAgeDays: 76,
  });
});
