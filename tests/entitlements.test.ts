import assert from "node:assert/strict";
import test from "node:test";

import {
  canCreateEvent,
  canUseFeature,
  getEffectiveEventLimits,
  getTeamMemberLimit,
  isEventTierUpgrade,
  showsPoweredByBadge,
  type AccountPlan,
  type EventFeature,
  type EventTier,
} from "../src/lib/entitlements";

test("one-time event tiers retain their own guest and response limits", () => {
  const cases: Array<[EventTier, number]> = [
    ["free", 50],
    ["event_pass", 250],
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

test("controlled beta accounts can run one complete 100-guest event", () => {
  const betaPlan = "beta" as AccountPlan;
  const shippedFeatures: EventFeature[] = [
    "smsInvites",
    "guestTags",
    "announcements",
    "signupBoard",
    "analytics",
    "teamCollab",
  ];

  assert.equal(canCreateEvent(betaPlan, 0), true);
  assert.equal(canCreateEvent(betaPlan, 1), false);
  assert.deepEqual(getEffectiveEventLimits(betaPlan, "free"), {
    guests: 100,
    responses: 100,
  });
  for (const feature of shippedFeatures) {
    assert.equal(canUseFeature(betaPlan, "free", feature), true);
  }
  assert.equal(getTeamMemberLimit(betaPlan, "free"), 3);
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
    guests: 50,
    responses: 50,
  });
});

test("team collaboration follows account and event limits including the owner", () => {
  assert.equal(canUseFeature("free", "free", "teamCollab"), false);
  assert.equal(canUseFeature("free", "gold", "teamCollab"), true);
  assert.equal(canUseFeature("pro_annual", "free", "teamCollab"), true);
  assert.equal(getTeamMemberLimit("free", "silver"), 1);
  assert.equal(getTeamMemberLimit("free", "gold"), 3);
  assert.equal(getTeamMemberLimit("pro_annual", "free"), 10);
});

test("the Event Pass unlocks every shipped event feature for one event", () => {
  const features: EventFeature[] = ["smsInvites", "guestTags", "announcements", "signupBoard", "analytics", "teamCollab", "removeBranding"];
  for (const feature of features) {
    assert.equal(canUseFeature("free", "event_pass", feature), true, feature);
  }
  assert.equal(canUseFeature("free", "free", "smsInvites"), false);
  assert.equal(getTeamMemberLimit("free", "event_pass"), 3);
});

test("paid upgrades must raise guest capacity, so legacy large tiers are never downgraded", () => {
  assert.equal(isEventTierUpgrade("free", "event_pass"), true);
  assert.equal(isEventTierUpgrade("silver", "event_pass"), true);
  assert.equal(isEventTierUpgrade("gold", "event_pass"), true);
  assert.equal(isEventTierUpgrade("event_pass", "event_pass"), false);
  assert.equal(isEventTierUpgrade("platinum", "event_pass"), false);
  assert.equal(isEventTierUpgrade("diamond", "event_pass"), false);
  assert.equal(isEventTierUpgrade("unknown-tier", "event_pass"), true);
});

test("the Powered by badge stays on free and beta events and is removed by paid plans", () => {
  assert.equal(showsPoweredByBadge("free", "free"), true);
  assert.equal(showsPoweredByBadge("beta", "free"), true);
  assert.equal(showsPoweredByBadge("free", "event_pass"), false);
  assert.equal(showsPoweredByBadge("free", "silver"), false);
  assert.equal(showsPoweredByBadge("pro_annual", "free"), false);
  assert.equal(showsPoweredByBadge("free", "not-a-tier"), true);
});
