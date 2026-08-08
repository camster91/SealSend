import assert from "node:assert/strict";
import test from "node:test";

import {
  canCreateEvent,
  canUseFeature,
  getEffectiveEventLimits,
  type AccountPlan,
  type EventFeature,
  type EventTier,
} from "../src/lib/entitlements";

test("one-time event tiers retain their own guest and response limits", () => {
  const cases: Array<[EventTier, number]> = [
    ["free", 15],
    ["silver", 50],
    ["gold", 150],
    ["platinum", 500],
    ["diamond", 750],
  ];

  for (const [eventTier, expectedLimit] of cases) {
    assert.deepEqual(getEffectiveEventLimits("free", eventTier), {
      guests: expectedLimit,
      responses: expectedLimit,
    });
  }
});

test("annual Pro grants unlimited events and 2,500 guests and responses per event", () => {
  assert.equal(canCreateEvent("pro_annual", 10_000), true);
  assert.deepEqual(getEffectiveEventLimits("pro_annual", "free"), {
    guests: 2_500,
    responses: 2_500,
  });
});

test("free accounts can create one event and no more", () => {
  assert.equal(canCreateEvent("free", 0), true);
  assert.equal(canCreateEvent("free", 1), false);
});

test("losing annual Pro never downgrades a separately purchased event tier", () => {
  const beforeCancellation = getEffectiveEventLimits("pro_annual", "diamond");
  const afterCancellation = getEffectiveEventLimits("free", "diamond");

  assert.deepEqual(beforeCancellation, { guests: 2_500, responses: 2_500 });
  assert.deepEqual(afterCancellation, { guests: 750, responses: 750 });
});

test("event features follow the purchased event tier while annual Pro unlocks all shipped features", () => {
  const premiumFeatures: EventFeature[] = [
    "smsInvites",
    "guestTags",
    "announcements",
    "signupBoard",
    "analytics",
  ];

  for (const feature of premiumFeatures) {
    assert.equal(canUseFeature("pro_annual", "free", feature), true);
  }

  assert.equal(canUseFeature("free", "free", "announcements"), false);
  assert.equal(canUseFeature("free", "silver", "announcements"), true);
  assert.equal(canUseFeature("free", "silver", "signupBoard"), false);
  assert.equal(canUseFeature("free", "gold", "signupBoard"), true);
});

test("unknown persisted account plans fail closed", () => {
  assert.deepEqual(getEffectiveEventLimits("business" as AccountPlan, "free"), {
    guests: 15,
    responses: 15,
  });
});
