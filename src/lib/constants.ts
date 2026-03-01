import { Palette, Mail, BarChart3, Users, Sparkles, Share2, Bell, Gift } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ========================================
// SAAS CONFIGURATION
// ========================================

/** 
 * BETA MODE - When true, all features are free and unlimited
 * Set to false when launching paid tiers
 */
export const BETA_MODE = true;

/** 
 * Feature flags for gradual rollout
 */
export const FEATURE_FLAGS = {
  subscriptions: false,     // Enable subscription billing
  teams: false,            // Enable team/organization features
  templates: false,        // Enable template gallery
  analytics: false,        // Enable advanced analytics
  aiAssistant: false,      // Enable AI design assistant
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

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for trying out SealSend",
    price: {
      monthly: 0,
      yearly: 0,
    },
    limits: {
      events: 3,
      guestsPerEvent: 50,
      responses: 100,
      teamMembers: 1,
      storageGB: 0.5,
    },
    features: [
      { name: "Digital invitations", included: true },
      { name: "RSVP tracking", included: true },
      { name: "Guest management", included: true },
      { name: "Basic customization", included: true },
      { name: "Email notifications", included: true },
      { name: "Custom domain", included: false },
      { name: "Remove branding", included: false },
      { name: "SMS notifications", included: false },
      { name: "Advanced analytics", included: false },
      { name: "Priority support", included: false },
    ],
    cta: {
      text: "Get Started Free",
      href: "/signup",
    },
  },
  {
    id: "pro",
    name: "Pro",
    description: "For hosts who want more flexibility",
    price: {
      monthly: 12,
      yearly: 99,
    },
    stripePriceId: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    },
    limits: {
      events: 10,
      guestsPerEvent: 200,
      responses: 1000,
      teamMembers: 3,
      storageGB: 5,
    },
    features: [
      { name: "Everything in Free", included: true },
      { name: "Remove SealSend branding", included: true },
      { name: "Custom domain", included: true },
      { name: "SMS notifications", included: true },
      { name: "Guest tags & groups", included: true },
      { name: "Advanced RSVP fields", included: true },
      { name: "Export to CSV/Excel", included: true },
      { name: "Message board", included: true },
      { name: "Advanced analytics", included: false },
      { name: "Priority support", included: false },
    ],
    popular: true,
    badges: ["Most Popular"],
    cta: {
      text: "Start Pro Trial",
      href: "/signup?plan=pro",
    },
  },
  {
    id: "business",
    name: "Business",
    description: "For professional event planners",
    price: {
      monthly: 39,
      yearly: 349,
    },
    stripePriceId: {
      monthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID,
    },
    limits: {
      events: "unlimited",
      guestsPerEvent: "unlimited",
      responses: "unlimited",
      teamMembers: 10,
      storageGB: 50,
    },
    features: [
      { name: "Everything in Pro", included: true },
      { name: "Unlimited events", included: true },
      { name: "Unlimited guests", included: true },
      { name: "Advanced analytics", included: true },
      { name: "Team collaboration", included: true },
      { name: "API access", included: true },
      { name: "White-label options", included: true },
      { name: "Priority support", included: true },
      { name: "Custom integrations", included: true },
      { name: "Dedicated account manager", included: true },
    ],
    badges: ["Best Value"],
    cta: {
      text: "Start Business Trial",
      href: "/signup?plan=business",
    },
  },
];

// ========================================
// LEGACY EVENT TIERS (Per-Event - Deprecated)
// ========================================

/** 
 * @deprecated Use SUBSCRIPTION_TIERS instead
 * Event-level tiers - only used when BETA_MODE is false and subscriptions not enabled
 */
export const TIERS = {
  free: {
    price: 0,
    maxResponses: 15,
    features: ["emailInvites", "basicRsvp"],
  },
  standard: {
    price: 5,
    maxResponses: 50,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements"],
  },
  premium: {
    price: 10,
    maxResponses: 1200,
    features: ["emailInvites", "smsInvites", "removeBranding", "guestTags", "announcements", "signupBoard"],
  },
} as const;

/** Beta uses premium limits for all events */
export const BETA_RESPONSE_LIMIT = TIERS.premium.maxResponses;

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
