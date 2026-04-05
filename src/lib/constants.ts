import { Palette, Mail, BarChart3, Users, Sparkles, Share2, Bell, Gift } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ========================================
// SAAS CONFIGURATION
// ========================================

/** 
 * BETA MODE - When true, all features are free and unlimited
 * Set to false when launching paid tiers
 */
export const BETA_MODE = false;

/**
 * Feature flags for gradual rollout
 */
export const FEATURE_FLAGS = {
  subscriptions: true,      // Enable subscription billing
  teams: false,            // Enable team/organization features (not yet implemented)
  templates: false,        // Enable template gallery (not yet implemented)
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
      { name: "Up to 15 guests", included: true },
      { name: "RSVP tracking", included: true },
      { name: "Basic templates", included: true },
      { name: "Email notifications", included: true },
      { name: "SealSend branding", included: true, tooltip: "Free invitations include SealSend branding" },
      { name: "Custom domain", included: false },
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
    stripePriceId: {
      monthly: process.env.STRIPE_SILVER_PRICE_ID,
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
      { name: "Photo gallery", included: true },
      { name: "SMS + email notifications", included: true },
      { name: "Guest tags & groups", included: true },
      { name: "Export to CSV", included: true },
      { name: "Ad-free experience", included: true },
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
    stripePriceId: {
      monthly: process.env.STRIPE_GOLD_PRICE_ID,
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
      { name: "Custom domain", included: true },
      { name: "Team collaboration", included: true },
      { name: "Advanced RSVP fields", included: true },
      { name: "Meal preferences & +1s", included: true },
      { name: "Seating chart tool", included: true },
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

// Additional per-event tiers (available via API / upgrade flow)
export const PREMIUM_TIERS = {
  platinum: {
    name: "Platinum",
    price: 34.99,
    guestsPerEvent: 500,
    description: "For galas & corporate events",
  },
  diamond: {
    name: "Diamond",
    price: 49.99,
    guestsPerEvent: 750,
    description: "For the biggest celebrations",
  },
};

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
    maxResponses: 15,
    features: ["emailInvites", "basicRsvp"],
  },
  silver: {
    price: 899,
    maxResponses: 50,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "customColors"],
  },
  gold: {
    price: 1799,
    maxResponses: 150,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "signupBoard", "customDomain", "teamCollab", "analytics"],
  },
  platinum: {
    price: 3499,
    maxResponses: 500,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "signupBoard", "customDomain", "teamCollab", "analytics", "api"],
  },
  diamond: {
    price: 4999,
    maxResponses: 750,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "signupBoard", "customDomain", "teamCollab", "analytics", "api", "priority"],
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
    title: "Beautiful Templates",
    description: "Start with professionally designed templates or upload your own custom invitation design.",
  },
  {
    icon: Mail,
    subtitle: "Delivery",
    title: "Email & SMS Invites",
    description: "Send invitations via email or text message. Track deliveries and opens in real-time.",
  },
  {
    icon: BarChart3,
    subtitle: "Analytics",
    title: "RSVP Tracking",
    description: "Watch responses roll in with beautiful charts. Track headcounts, meal choices, and more.",
  },
  {
    icon: Users,
    subtitle: "Management",
    title: "Guest Management",
    description: "Organize guests with tags, plus-ones, and custom fields. Import from CSV or add manually.",
  },
  {
    icon: Sparkles,
    subtitle: "Experience",
    title: "Magical Experience",
    description: "Guests get a stunning invitation page with RSVP form, event details, and message board.",
  },
  {
    icon: Share2,
    subtitle: "Sharing",
    title: "Easy Sharing",
    description: "Share via custom link, QR code, or social media. No app download required for guests.",
  },
  {
    icon: Bell,
    subtitle: "Communication",
    title: "Announcements",
    description: "Send updates to all guests instantly. Perfect for last-minute changes or reminders.",
  },
  {
    icon: Gift,
    subtitle: "Extras",
    title: "Registry Integration",
    description: "Link to your gift registry, donation page, or any external site your guests need.",
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
    slug: "weddings",
    title: "Weddings",
    description: "Create elegant wedding invitations with RSVP tracking, meal preferences, and plus-one management.",
    image: "/use-cases/wedding.jpg",
    features: ["Registry integration", "Meal preferences", "Plus-one tracking", "Save the dates"],
  },
  {
    slug: "baby-showers",
    title: "Baby Showers",
    description: "Celebrate the upcoming arrival with adorable invitations and gift registry links.",
    image: "/use-cases/baby-shower.jpg",
    features: ["Registry links", "Gender reveal option", "Gift tracking", "Photo sharing"],
  },
  {
    slug: "birthday-parties",
    title: "Birthday Parties",
    description: "From first birthdays to milestone celebrations, make every birthday special.",
    image: "/use-cases/birthday.jpg",
    features: ["Age-appropriate themes", "RSVP by date", "Gift preferences", "Photo gallery"],
  },
  {
    slug: "corporate-events",
    title: "Corporate Events",
    description: "Professional invitations for company events, conferences, and team gatherings.",
    image: "/use-cases/corporate.jpg",
    features: ["Branded templates", "Calendar invites", "Attendee tracking", "Polls & surveys"],
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
