export interface UseCaseData {
  slug: string;
  indexIcon: "Users" | "Heart" | "BadgeCheck" | "Briefcase";
  indexDescription: string;
  indexFeatures: string[];
  metaTitle: string;
  metaDescription: string;
  heroHeadline: string;
  heroSubtext: string;
  benefits: { icon: string; title: string; description: string }[];
  faqs: { question: string; answer: string }[];
  ctaText: string;
  keywords: string[];
}

const betaCapacityAnswer =
  "The controlled beta supports one active event with up to 100 guests. Paid checkout is disabled while SealSend completes provider, compliance, accessibility, and real-event launch evidence.";

export const USE_CASES: Record<string, UseCaseData> = {
  "community-events": {
    slug: "community-events",
    indexIcon: "Users",
    indexDescription: "Keep invitations, RSVPs, guest segments, approved updates, and arrival status connected for a real community gathering.",
    indexFeatures: ["Guest tags", "Co-host roles", "Mobile check-in", "Approved updates"],
    metaTitle: "Community Event Invitations and RSVP Workflow",
    metaDescription: "Run a community event from an editable invitation and RSVP through guest updates and check-in in SealSend's controlled beta.",
    heroHeadline: "One Guest Workflow for Community Events",
    heroSubtext: "For creative communities, alumni groups, neighborhood organizers, and recurring gatherings that need more than a link and a spreadsheet.",
    benefits: [
      { icon: "ClipboardList", title: "Start from the event brief", description: "Build an editable event page and RSVP questions from the details your organizing team already has." },
      { icon: "Tag", title: "Keep the guest list actionable", description: "Use tags, response status, plus-ones, and custom fields to identify who needs an answer or update." },
      { icon: "Megaphone", title: "Approve updates before sending", description: "Review the resolved audience, channel, schedule, and available cost estimate before an external communication starts." },
      { icon: "Users", title: "Share event-day work", description: "Give a small co-host team permission-based access and keep guest check-in status current from a mobile browser." },
    ],
    faqs: [
      { question: "What size community event fits the beta?", answer: betaCapacityAnswer },
      { question: "Do guests need a SealSend account?", answer: "No. Guests open the published event link in a browser and submit the RSVP form without creating an account or installing an app." },
      { question: "Can several organizers help?", answer: "Yes. The controlled beta allows up to three team members including the owner, with manager, check-in, and viewer roles." },
      { question: "Does SealSend send messages without approval?", answer: "No. The host must approve an external send or schedule. Live email and SMS are enabled only after provider readiness is confirmed for the consented beta host." },
    ],
    ctaText: "Start a Community Event",
    keywords: ["community event RSVP", "community event invitations", "event guest list", "community event check in"],
  },
  "nonprofit-events": {
    slug: "nonprofit-events",
    indexIcon: "Heart",
    indexDescription: "Coordinate local nonprofit gatherings, volunteer events, and supporter briefings without adopting enterprise event software.",
    indexFeatures: ["Custom RSVP fields", "Sign-up board", "Guest export", "Co-host access"],
    metaTitle: "Local Nonprofit Event Invitations and RSVP",
    metaDescription: "Coordinate a local nonprofit or volunteer event with custom RSVP questions, sign-ups, guest updates, and check-in.",
    heroHeadline: "Practical Event Operations for Local Nonprofits",
    heroSubtext: "Collect the participation details your team needs, coordinate volunteer responsibilities, and keep the guest record usable through event day.",
    benefits: [
      { icon: "ClipboardList", title: "Ask the questions that affect delivery", description: "Add custom RSVP fields for accessibility needs, dietary requirements, roles, or other event-specific planning details." },
      { icon: "Calendar", title: "Coordinate sign-up needs", description: "Use the event sign-up board for bounded roles or items, with availability kept alongside the event." },
      { icon: "Mail", title: "Keep communication deliberate", description: "Resolve the intended audience and require host approval before email or SMS communication leaves SealSend." },
      { icon: "BarChart3", title: "Retain a usable record", description: "Review aggregate response status and export guest information for an authorized operational follow-up or event-day fallback." },
    ],
    faqs: [
      { question: "What is included during the controlled beta?", answer: betaCapacityAnswer },
      { question: "Can SealSend collect donations or sell tickets?", answer: "No. SealSend does not currently process donations or ticket sales. You can place an approved external link on the event page when another service owns that transaction." },
      { question: "Can we collect accessibility or volunteer details?", answer: "Yes. Organizers can configure custom RSVP questions and use a sign-up board for event-specific roles or items." },
      { question: "How is guest communication controlled?", answer: "The organizer reviews recipients, channels, schedule, and the available cost estimate before approving an external send. Provider readiness remains a separate beta gate." },
    ],
    ctaText: "Start a Nonprofit Event",
    keywords: ["nonprofit event RSVP", "volunteer event invitations", "nonprofit guest management", "community nonprofit events"],
  },
  "clubs-associations": {
    slug: "clubs-associations",
    indexIcon: "BadgeCheck",
    indexDescription: "Run chapter meetings, member gatherings, workshops, and annual events from a repeatable organizer workflow.",
    indexFeatures: ["Next-event setup", "Member tags", "RSVP status", "Calendar links"],
    metaTitle: "Club and Association Event RSVP Workflow",
    metaDescription: "Create repeatable club and association events with invitations, custom RSVP questions, member tags, updates, and check-in.",
    heroHeadline: "A Repeatable Event Workflow for Clubs and Associations",
    heroSubtext: "Give recurring organizers a reliable starting point without turning SealSend into a membership database or enterprise event suite.",
    benefits: [
      { icon: "Calendar", title: "Reuse structure with a new schedule", description: "Start the next event from a proven structure, choose a new schedule, and explicitly decide whether to carry guest contact details forward." },
      { icon: "Tag", title: "Organize event participants", description: "Apply guest tags and response filters for chapters, committees, attendance types, or other event-specific segments." },
      { icon: "Users", title: "Track responses and plus-ones", description: "Keep invitations, replies, headcount, plus-ones, and response corrections connected to the event record." },
      { icon: "Share2", title: "Give guests the current details", description: "Publish a browser-based event page and provide calendar links so approved event details remain easy to revisit." },
    ],
    faqs: [
      { question: "How many events can a beta organizer run?", answer: betaCapacityAnswer },
      { question: "Is SealSend a membership management system?", answer: "No. SealSend manages an event and its guests. It does not currently manage dues, membership renewals, or a permanent member directory." },
      { question: "Can an organizer reuse a previous event?", answer: "Yes. An authorized organizer can start the next event as a new draft, choose a new schedule, and explicitly decide whether to reuse guest contact details before publishing." },
      { question: "Can guests correct an RSVP?", answer: "The host can manage responses and send a scoped guest update link when an invited guest needs to revise submitted information." },
    ],
    ctaText: "Start a Club Event",
    keywords: ["club event RSVP", "association event invitations", "member event guest list", "chapter event check in"],
  },
  "professional-gatherings": {
    slug: "professional-gatherings",
    indexIcon: "Briefcase",
    indexDescription: "Operate workshops, networking nights, alumni gatherings, and small professional events with clear approvals.",
    indexFeatures: ["Uploaded artwork", "Custom questions", "Guest segments", "Check-in and export"],
    metaTitle: "Small Professional Event Invitations and RSVP",
    metaDescription: "Run a workshop, networking event, or small professional gathering with custom RSVP fields, guest updates, and check-in.",
    heroHeadline: "Professional Guest Operations Without Enterprise Overhead",
    heroSubtext: "For independent planners and small teams that need a polished event page, actionable attendee information, and a controlled event-day workflow.",
    benefits: [
      { icon: "Share2", title: "Use approved event artwork", description: "Choose a shipped template or upload invitation artwork while preserving the original file and reviewing the crop." },
      { icon: "ClipboardList", title: "Collect operational details", description: "Configure RSVP questions for attendance, dietary needs, accessibility, sessions, or other facts the event team needs." },
      { icon: "Megaphone", title: "Target an approved audience", description: "Filter by guest and response status, review resolved recipients, and approve an update before sending or scheduling it." },
      { icon: "BarChart3", title: "Prepare for event day", description: "Use aggregate response status, authorized exports, co-host roles, and mobile check-in as one connected workflow." },
    ],
    faqs: [
      { question: "What event size is supported in the beta?", answer: betaCapacityAnswer },
      { question: "Does SealSend replace an enterprise event platform?", answer: "No. SealSend is intentionally scoped to a small organizer's invitation-to-check-in workflow. It does not currently provide ticketing, sponsor management, venue sourcing, or CRM integrations." },
      { question: "Can we use our own invitation artwork?", answer: "Yes. Organizers can upload supported artwork, review the displayed crop, and retain the uploaded original." },
      { question: "Can attendee information be exported?", answer: "Yes. An authorized organizer can export event-scoped guest or response information for legitimate event operations." },
    ],
    ctaText: "Start a Professional Gathering",
    keywords: ["professional event RSVP", "networking event invitations", "workshop guest management", "small event check in"],
  },
};

export const LEGACY_USE_CASE_REDIRECTS: Record<string, keyof typeof USE_CASES> = {
  weddings: "professional-gatherings",
  "baby-showers": "community-events",
  "birthday-parties": "community-events",
  "corporate-events": "professional-gatherings",
};

export const USE_CASE_SLUGS = Object.keys(USE_CASES);
