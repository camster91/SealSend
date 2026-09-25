import { Palette, Mail, BarChart3, Users, Sparkles, Share2, Bell, Gift } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ========================================
// SAAS CONFIGURATION
// ========================================

/**
 * BETA MODE - When true, paid checkout is hidden and accounts receive the
 * bounded controlled-beta entitlement: one active event for up to 100 guests.
 * Set to false only after every mandatory paid-launch gate passes.
 */
export const BETA_MODE = true;

/**
 * Feature flags for gradual rollout
 */
export const FEATURE_FLAGS = {
  subscriptions: true,      // Enable subscription billing
  teams: true,             // Event-level co-host roles and invitations
  templates: true,         // Curated editable event templates
  analytics: true,          // Enable advanced analytics
  aiAssistant: false,      // Enable AI design assistant (not yet implemented)
} as const;

// ========================================
// SUBSCRIPTION TIERS (User-Level)
// ========================================

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  stripePriceId?: {
    monthly?: string;
    yearly?: string;
  };
  features: {
    name: string;
    included: boolean;
    tooltip?: string;
  }[];
  limits: {
    events: number | "unlimited";
    guestsPerEvent: number | "unlimited";
    responses: number | "unlimited";
    teamMembers: number;
    storageGB: number;
  };
  badges?: string[];
  popular?: boolean;
  cta: {
    text: string;
    href: string;
  };
}

// Evite-style per-event pricing at 50% less than Evite
// Evite: Silver $17.99/12g, Gold $36.99/30g, Platinum $68.99/75g, Diamond $99.99/750g, Pro $249.99/yr
// SealSend: 50% cheaper with more generous guest limits

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for small gatherings",
    price: {
      monthly: 0,
      yearly: 0,
    },
    limits: {
      events: 1,
      guestsPerEvent: 15,
      responses: 30,
      teamMembers: 1,
      storageGB: 0.25,
    },
    features: [
      { name: "1 event", included: true },
      { name: "Up to 50 guests", included: true },
      { name: "RSVP tracking", included: true },
      { name: "Basic templates", included: true },
      { name: "Email notifications", included: true },
      { name: "SealSend branding", included: true, tooltip: "Free invitations include SealSend branding" },
      { name: "Remove branding", included: false },
      { name: "SMS notifications", included: false },
      { name: "Advanced analytics", included: false },
    ],
    cta: {
      text: "Get Started Free",
      href: "/signup",
    },
  },
  {
    id: "pro",
    name: "Silver",
    description: "Great for birthday parties & dinners",
    price: {
      monthly: 8.99,
      yearly: 8.99,
    },
    limits: {
      events: 1,
      guestsPerEvent: 50,
      responses: 100,
      teamMembers: 1,
      storageGB: 1,
    },
    features: [
      { name: "1 premium event", included: true },
      { name: "Up to 50 guests", included: true },
      { name: "Premium templates", included: true },
      { name: "No SealSend branding", included: true },
      { name: "Custom colors & fonts", included: true },
      { name: "SMS + email notifications", included: true },
      { name: "Guest tags & groups", included: true },
      { name: "Export to CSV", included: true },
    ],
    popular: true,
    badges: ["Most Popular"],
    cta: {
      text: "Create Event — $8.99",
      href: "/signup?plan=silver",
    },
  },
  {
    id: "business",
    name: "Gold",
    description: "Perfect for weddings & large celebrations",
    price: {
      monthly: 17.99,
      yearly: 17.99,
    },
    limits: {
      events: 1,
      guestsPerEvent: 150,
      responses: 300,
      teamMembers: 3,
      storageGB: 5,
    },
    features: [
      { name: "Everything in Silver", included: true },
      { name: "Up to 150 guests", included: true },
      { name: "Team collaboration", included: true },
      { name: "Advanced RSVP fields", included: true },
      { name: "Meal preferences & +1s", included: true },
      { name: "Message board", included: true },
      { name: "Advanced analytics", included: true },
      { name: "Priority support", included: true },
    ],
    cta: {
      text: "Create Event — $17.99",
      href: "/signup?plan=gold",
    },
  },
];

// Unlimited yearly plan (competitor to Evite Pro at $249.99/yr)
export const PRO_ANNUAL = {
  name: "SealSend Pro",
  price: 124.99,
  interval: "year" as const,
  description: "Unlimited premium events for power hosts & event planners",
  guestsPerEvent: 2500,
  events: "unlimited",
  stripePriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
};

export const EVENT_PASS = {
  name: "Event Pass",
  priceCents: 1200,
  guestsPerEvent: 250,
} as const;

export const PUBLIC_PRICING_PLANS = [
  { id: "free", name: "Free", price: 0, period: "", description: "One small event, free", events: "1", guests: "50", features: ["Email invitations", "RSVP tracking", "Guest management", "\"Powered by SealSend\" badge"] },
  { id: "event_pass", name: "Event Pass", price: EVENT_PASS.priceCents / 100, period: "/event", description: "Everything for one bigger event", events: "1", guests: "250", features: ["Email and SMS invitations", "Guest tags, announcements and sign-up board", "Analytics and up to 3 co-hosts", "No SealSend badge"] },
  { id: "pro_annual", name: "SealSend Pro", price: 124.99, period: "/year", description: "For repeat hosts and event planners", events: "Unlimited", guests: "2,500", features: ["All shipped premium features", "Unlimited events", "2,500 guests per event"], popular: true },
] as const;

export const CONTROLLED_BETA_PRICING_PLAN = {
  id: "controlled_beta",
  name: "Controlled Beta",
  price: 0,
  period: "",
  description: "Run one real event while we verify paid-launch evidence",
  events: "1 active",
  guests: "100",
  features: [
    "Invitation, RSVP, and guest workflow",
    "Host-approved email and SMS communications",
    "Guest tags, co-hosts, analytics, and check-in",
  ],
} as const;

// ========================================
// LEGACY EVENT TIERS (Per-Event - Deprecated)
// ========================================

/** 
 * @deprecated Use SUBSCRIPTION_TIERS instead
 * Event-level tiers - only used when BETA_MODE is false and subscriptions not enabled
 */
// Event-level tiers (used by checkout and webhook handlers)
export const TIERS = {
  free: {
    price: 0,
    maxResponses: 50,
    features: ["emailInvites", "basicRsvp"],
  },
  event_pass: {
    price: EVENT_PASS.priceCents,
    maxResponses: EVENT_PASS.guestsPerEvent,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "signupBoard", "teamCollab", "analytics"],
  },
  silver: {
    price: 899,
    maxResponses: 50,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "customColors"],
  },
  gold: {
    price: 1799,
    maxResponses: 150,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "signupBoard", "teamCollab", "analytics"],
  },
  platinum: {
    price: 3499,
    maxResponses: 500,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "signupBoard", "teamCollab", "analytics", "api"],
  },
  diamond: {
    price: 4999,
    maxResponses: 750,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "signupBoard", "teamCollab", "analytics", "api", "priority"],
  },
  // Backwards compatibility
  standard: {
    price: 899,
    maxResponses: 50,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements"],
  },
  premium: {
    price: 1799,
    maxResponses: 150,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "signupBoard"],
  },
} as const;

export const BETA_RESPONSE_LIMIT = TIERS.diamond.maxResponses;

// ========================================
// FEATURES LIST (Marketing)
// ========================================

export interface Feature {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  description: string;
}

export const FEATURES_LIST: Feature[] = [
  {
    icon: Palette,
    subtitle: "Design",
    title: "Invitation studio",
    description: "Choose a shipped editable template or upload invitation artwork, then review the crop before publishing.",
  },
  {
    icon: Mail,
    subtitle: "Approval",
    title: "Host-approved communications",
    description: "Review the resolved audience, channel, schedule, and available cost status before an email or text can be sent.",
  },
  {
    icon: BarChart3,
    subtitle: "Responses",
    title: "RSVP operations",
    description: "Track attendance, headcount, plus-ones, custom answers, and authorized corrections from the event record.",
  },
  {
    icon: Users,
    subtitle: "Guest list",
    title: "Actionable guest list",
    description: "Import or add guests, apply tags, filter response states, and export event-scoped information for legitimate operations.",
  },
  {
    icon: Sparkles,
    subtitle: "Guest access",
    title: "Published guest experience",
    description: "Guests open the current event details and RSVP form in a browser without creating an account or installing an app.",
  },
  {
    icon: Share2,
    subtitle: "Access",
    title: "Calendar and QR access",
    description: "Provide a published event link, stable calendar details, and event QR access from the same approved record.",
  },
  {
    icon: Bell,
    subtitle: "Event day",
    title: "Co-hosts and check-in",
    description: "Give a small team permission-based access, refresh check-in state, and retain a printable fallback for degraded connectivity.",
  },
  {
    icon: Gift,
    subtitle: "Repeat use",
    title: "Next-event workflow",
    description: "Reuse event structure with a required new schedule and an explicit decision about guest contact reuse.",
  },
];

// ========================================
// DEFAULT RSVP FIELDS
// ========================================

export const DEFAULT_RSVP_FIELDS = [
  {
    field_name: "name",
    field_type: "text",
    field_label: "Full Name",
    is_required: true,
    is_enabled: true,
    placeholder: "Enter your full name",
  },
  {
    field_name: "email",
    field_type: "email",
    field_label: "Email Address",
    is_required: true,
    is_enabled: true,
    placeholder: "your@email.com",
  },
  {
    field_name: "attending",
    field_type: "select",
    field_label: "Will you be attending?",
    is_required: true,
    is_enabled: true,
    options: ["Joyfully Accepts", "Regretfully Declines"],
  },
  {
    field_name: "guests",
    field_type: "number",
    field_label: "Number of Guests",
    is_required: false,
    is_enabled: true,
    placeholder: "Including yourself",
  },
  {
    field_name: "dietary",
    field_type: "textarea",
    field_label: "Dietary Requirements",
    is_required: false,
    is_enabled: true,
    placeholder: "Any allergies or dietary restrictions?",
  },
  {
    field_name: "message",
    field_type: "textarea",
    field_label: "Message to Host",
    is_required: false,
    is_enabled: true,
    placeholder: "Leave a nice message for the host...",
  },
];

// ========================================
// USE CASES
// ========================================

export const USE_CASES = [
  {
    slug: "community-events",
    title: "Community Events",
    description: "Connect invitations, guest decisions, approved updates, and check-in for recurring gatherings.",
    features: ["Guest tags", "Co-host roles", "Approved updates", "Mobile check-in"],
  },
  {
    slug: "nonprofit-events",
    title: "Local Nonprofits",
    description: "Coordinate local nonprofit and volunteer events with operational RSVP details.",
    features: ["Custom RSVP fields", "Sign-up board", "Guest export", "Co-host access"],
  },
  {
    slug: "clubs-associations",
    title: "Clubs & Associations",
    description: "Reuse a proven event workflow for chapters, meetings, and member gatherings.",
    features: ["Next-event setup", "Guest tags", "RSVP status", "Calendar links"],
  },
  {
    slug: "professional-gatherings",
    title: "Professional Gatherings",
    description: "Run workshops and networking events without enterprise event-software overhead.",
    features: ["Uploaded artwork", "Custom questions", "Guest segments", "Check-in and export"],
  },
] as const;

// ========================================
// NAVIGATION
// ========================================

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Use Cases", href: "#use-cases", children: USE_CASES.map(u => ({ label: u.title, href: `/use-cases/${u.slug}` })) },
] as const;
