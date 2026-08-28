export type AccountPlan = "free" | "beta" | "pro_annual";

export type EventTier =
  | "free"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "standard"
  | "premium";

export type EventFeature =
  | "smsInvites"
  | "guestTags"
  | "announcements"
  | "signupBoard"
  | "analytics"
  | "teamCollab";

type EventLimits = {
  guests: number;
  responses: number;
};

const EVENT_LIMITS: Record<EventTier, EventLimits> = {
  free: { guests: 15, responses: 15 },
  silver: { guests: 50, responses: 50 },
  gold: { guests: 150, responses: 150 },
  platinum: { guests: 500, responses: 500 },
  diamond: { guests: 750, responses: 750 },
  standard: { guests: 50, responses: 50 },
  premium: { guests: 150, responses: 150 },
};

const EVENT_FEATURES: Record<EventFeature, EventTier[]> = {
  smsInvites: ["silver", "gold", "platinum", "diamond", "standard", "premium"],
  guestTags: ["silver", "gold", "platinum", "diamond", "standard", "premium"],
  announcements: ["silver", "gold", "platinum", "diamond", "standard", "premium"],
  signupBoard: ["gold", "platinum", "diamond", "premium"],
  analytics: ["gold", "platinum", "diamond"],
  teamCollab: ["gold", "platinum", "diamond", "premium"],
};

const EVENT_TEAM_LIMITS: Record<EventTier, number> = {
  free: 1,
  silver: 1,
  gold: 3,
  platinum: 5,
  diamond: 10,
  standard: 1,
  premium: 3,
};

function isAnnualPro(accountPlan: AccountPlan): boolean {
  return accountPlan === "pro_annual";
}

function isControlledBeta(accountPlan: AccountPlan): boolean {
  return accountPlan === "beta";
}

export function canCreateEvent(accountPlan: AccountPlan, existingEventCount: number): boolean {
  return isAnnualPro(accountPlan) || existingEventCount < 1;
}

export function getEffectiveEventLimits(
  accountPlan: AccountPlan,
  eventTier: EventTier,
): EventLimits {
  if (isAnnualPro(accountPlan)) {
    return { guests: 2_500, responses: 2_500 };
  }

  if (isControlledBeta(accountPlan)) {
    return { guests: 100, responses: 100 };
  }

  return EVENT_LIMITS[eventTier] ?? EVENT_LIMITS.free;
}

export function canUseFeature(
  accountPlan: AccountPlan,
  eventTier: EventTier,
  feature: EventFeature,
): boolean {
  return isAnnualPro(accountPlan) || isControlledBeta(accountPlan) || EVENT_FEATURES[feature].includes(eventTier);
}

export function getTeamMemberLimit(
  accountPlan: AccountPlan,
  eventTier: EventTier,
): number {
  if (isAnnualPro(accountPlan)) return 10;
  if (isControlledBeta(accountPlan)) return 3;
  return EVENT_TEAM_LIMITS[eventTier] ?? 1;
}
