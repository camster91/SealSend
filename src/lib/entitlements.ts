export type AccountPlan = "free" | "beta" | "pro_annual";

export type EventTier =
  | "free"
  | "event_pass"
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
  | "teamCollab"
  | "removeBranding";

type EventLimits = {
  guests: number;
  responses: number;
};

// Only `free` and `event_pass` are sold. The other one-time tiers are legacy
// purchases that keep the limits they were bought with.
const EVENT_LIMITS: Record<EventTier, EventLimits> = {
  free: { guests: 50, responses: 50 },
  event_pass: { guests: 250, responses: 250 },
  silver: { guests: 50, responses: 50 },
  gold: { guests: 150, responses: 150 },
  platinum: { guests: 500, responses: 500 },
  diamond: { guests: 750, responses: 750 },
  standard: { guests: 50, responses: 50 },
  premium: { guests: 150, responses: 150 },
};

const EVENT_FEATURES: Record<EventFeature, EventTier[]> = {
  smsInvites: ["event_pass", "silver", "gold", "platinum", "diamond", "standard", "premium"],
  guestTags: ["event_pass", "silver", "gold", "platinum", "diamond", "standard", "premium"],
  announcements: ["event_pass", "silver", "gold", "platinum", "diamond", "standard", "premium"],
  signupBoard: ["event_pass", "gold", "platinum", "diamond", "premium"],
  analytics: ["event_pass", "gold", "platinum", "diamond"],
  teamCollab: ["event_pass", "gold", "platinum", "diamond", "premium"],
  removeBranding: ["event_pass", "silver", "gold", "platinum", "diamond", "standard", "premium"],
};

const EVENT_TEAM_LIMITS: Record<EventTier, number> = {
  free: 1,
  event_pass: 3,
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

export function isEventTier(value: string): value is EventTier {
  return Object.prototype.hasOwnProperty.call(EVENT_LIMITS, value);
}

/** Paid upgrades must raise the event's guest capacity. */
export function isEventTierUpgrade(currentTier: string, targetTier: EventTier): boolean {
  const current = isEventTier(currentTier) ? EVENT_LIMITS[currentTier].guests : EVENT_LIMITS.free.guests;
  return EVENT_LIMITS[targetTier].guests > current;
}

/**
 * The "Powered by" badge stays on free events, including controlled-beta
 * events. Paid event tiers and annual Pro remove it.
 */
export function showsPoweredByBadge(accountPlan: AccountPlan, eventTier: string): boolean {
  if (isAnnualPro(accountPlan)) return false;
  return !(isEventTier(eventTier) && EVENT_FEATURES.removeBranding.includes(eventTier));
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
