export interface UseCaseData {
  slug: string;
  /** Short name for cards, menus and breadcrumbs. */
  name: string;
  /** Photo in public/brand/photos, used on cards and as the page hero. */
  image: string;
  imageAlt: string;
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
  "SealSend is a free beta. Each account can run one active event with up to 100 guests. Paid plans are not available yet.";

export const USE_CASES: Record<string, UseCaseData> = {
  "community-events": {
    slug: "community-events",
    name: "Community events",
    image: "/brand/photos/community.webp",
    imageAlt: "Neighbours setting out dishes at a community potluck while an organizer checks the guest list on a tablet",
    indexDescription: "Keep invitations, RSVPs, guest segments, approved updates, and arrival status connected for a real community gathering.",
    indexFeatures: ["Guest tags", "Co-host roles", "Mobile check-in", "Approved updates"],
    metaTitle: "Community Event Invitations and RSVP Workflow",
    metaDescription: "Run a community event from an editable invitation and RSVP through guest updates and check-in in SealSend's free beta.",
    heroHeadline: "Run the monthly potluck without the spreadsheet.",
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
      { question: "Can several organizers help?", answer: "Yes. The free beta allows up to three team members including the owner, with manager, check-in, and viewer roles." },
      { question: "Does SealSend send messages without approval?", answer: "No. The host must approve an external send or schedule. Email invitations work today. SMS is turned off for now." },
    ],
    ctaText: "Start a community event",
    keywords: ["community event RSVP", "community event invitations", "event guest list", "community event check in"],
  },
  "nonprofit-events": {
    slug: "nonprofit-events",
    name: "Local nonprofits",
    image: "/brand/photos/door-checkin.webp",
    imageAlt: "A volunteer at a welcome table scanning the QR code on a guest's phone as she arrives",
    indexDescription: "Coordinate local nonprofit gatherings, volunteer events, and supporter briefings without adopting enterprise event software.",
    indexFeatures: ["Custom RSVP fields", "Sign-up board", "Guest export", "Co-host access"],
    metaTitle: "Local Nonprofit Event Invitations and RSVP",
    metaDescription: "Coordinate a local nonprofit or volunteer event with custom RSVP questions, sign-ups, guest updates, and check-in.",
    heroHeadline: "Volunteer nights and supporter events, without enterprise software.",
    heroSubtext: "Collect the participation details your team needs, coordinate volunteer responsibilities, and keep the guest record usable through event day.",
    benefits: [
      { icon: "ClipboardList", title: "Ask the questions that affect delivery", description: "Add custom RSVP fields for accessibility needs, dietary requirements, roles, or other event-specific planning details." },
      { icon: "Calendar", title: "Coordinate sign-up needs", description: "Use the event sign-up board for bounded roles or items, with availability kept alongside the event." },
      { icon: "Mail", title: "Keep communication deliberate", description: "Resolve the intended audience and require host approval before any email leaves SealSend." },
      { icon: "BarChart3", title: "Retain a usable record", description: "Review aggregate response status and export guest information for an authorized operational follow-up or event-day fallback." },
    ],
    faqs: [
      { question: "What is included during the free beta?", answer: betaCapacityAnswer },
      { question: "Can SealSend collect donations or sell tickets?", answer: "No. SealSend does not currently process donations or ticket sales. You can place an external link on the event page when another service owns that transaction." },
      { question: "Can we collect accessibility or volunteer details?", answer: "Yes. Organizers can configure custom RSVP questions and use a sign-up board for event-specific roles or items." },
      { question: "How is guest communication controlled?", answer: "The organizer reviews recipients, channels, schedule, and the available cost estimate before approving an external send." },
    ],
    ctaText: "Start a nonprofit event",
    keywords: ["nonprofit event RSVP", "volunteer event invitations", "nonprofit guest management", "community nonprofit events"],
  },
  "clubs-associations": {
    slug: "clubs-associations",
    name: "Clubs and associations",
    image: "/brand/photos/guest-updates.webp",
    imageAlt: "A guest outside a community hall holding a phone with a text from the hosts: doors open at 6:30, parking is behind the hall",
    indexDescription: "Run chapter meetings, member gatherings, workshops, and annual events from a repeatable organizer workflow.",
    indexFeatures: ["Next-event setup", "Member tags", "RSVP status", "Calendar links"],
    metaTitle: "Club and Association Event RSVP Workflow",
    metaDescription: "Create repeatable club and association events with invitations, custom RSVP questions, member tags, updates, and check-in.",
    heroHeadline: "Every meeting starts from the last one.",
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
    ctaText: "Start a club event",
    keywords: ["club event RSVP", "association event invitations", "member event guest list", "chapter event check in"],
  },
  "professional-gatherings": {
    slug: "professional-gatherings",
    name: "Professional gatherings",
    image: "/brand/photos/track-rsvps.webp",
    imageAlt: "A host at a table reading a guest list that shows who is going, who might come and dietary notes",
    indexDescription: "Operate workshops, networking nights, alumni gatherings, and small professional events with clear approvals.",
    indexFeatures: ["Uploaded artwork", "Custom questions", "Guest segments", "Check-in and export"],
    metaTitle: "Small Professional Event Invitations and RSVP",
    metaDescription: "Run a workshop, networking event, or small professional gathering with custom RSVP fields, guest updates, and check-in.",
    heroHeadline: "Workshops and networking nights, handled from one guest list.",
    heroSubtext: "For independent planners and small teams that need a polished event page, actionable attendee information, and a controlled event-day workflow.",
    benefits: [
      { icon: "Share2", title: "Use approved event artwork", description: "Choose a shipped template or upload invitation artwork while preserving the original file and reviewing the crop." },
      { icon: "ClipboardList", title: "Collect operational details", description: "Configure RSVP questions for attendance, dietary needs, accessibility, sessions, or other facts the event team needs." },
      { icon: "Megaphone", title: "Target an approved audience", description: "Filter by guest and response status, review resolved recipients, and approve an update before sending or scheduling it." },
      { icon: "BarChart3", title: "Prepare for event day", description: "Use aggregate response status, authorized exports, co-host roles, and mobile check-in as one connected workflow." },
    ],
    faqs: [
      { question: "What event size is supported in the beta?", answer: betaCapacityAnswer },
      { question: "Does SealSend replace an enterprise event platform?", answer: "No. SealSend is intentionally scoped to a small organizer's invitation-to-check-in workflow. It does not currently provide ticketing, sponsor management, or venue sourcing. RSVPs, check-ins and approvals can be sent to a CRM or Zapier through signed workspace webhooks." },
      { question: "Can we use our own invitation artwork?", answer: "Yes. Organizers can upload supported artwork, review the displayed crop, and retain the uploaded original." },
      { question: "Can attendee information be exported?", answer: "Yes. An authorized organizer can export event-scoped guest or response information for legitimate event operations." },
    ],
    ctaText: "Start a professional event",
    keywords: ["professional event RSVP", "networking event invitations", "workshop guest management", "small event check in"],
  },
  "event-planners": {
    slug: "event-planners",
    name: "Event planners",
    image: "/brand/photos/planners.webp",
    imageAlt: "A planner's desk with a laptop showing a client approval marked Approved, a floor plan, fabric swatches and a wax seal stamp",
    indexDescription: "For independent planners and small studios running events for clients: a team workspace, your own brand, client records and review links.",
    indexFeatures: ["Team workspace", "Brand kit", "Client review links", "Webhooks"],
    metaTitle: "Event Planner Workspace for Client Events",
    metaDescription: "Run client events under your own brand with a team workspace, client records, read-only review links with approvals, and RSVP webhooks.",
    heroHeadline: "Run client events under your own brand.",
    heroSubtext: "For independent planners and small studios. Keep every client event in one team workspace, put your brand on invitations, and get sign-off from clients before anything goes out.",
    benefits: [
      { icon: "Users", title: "One workspace for your team", description: "Invite planners and check-in staff to a shared workspace. Roles decide who can edit events, manage clients, or only check guests in at the door." },
      { icon: "Palette", title: "Your brand on every event", description: "Set your logo, colours, font, email sender name and reply-to address once. Every event in the workspace uses them." },
      { icon: "Share2", title: "Client review and approval", description: "Keep a record for each client and send them a read-only review link with live RSVP totals, never guest details. Their approval is recorded on the event." },
      { icon: "Plug", title: "Connect the tools you already use", description: "Signed webhooks send each RSVP, check-in, publish and client approval to Zapier, Make or your own CRM, with retries if your endpoint is down." },
    ],
    faqs: [
      { question: "What is included during the free beta?", answer: `${betaCapacityAnswer} Workspaces, the brand kit, client records, review links and webhooks are all available to beta organizers at no cost.` },
      { question: "Can I remove SealSend's name completely?", answer: "Not yet. During the beta, emails and texts show your brand followed by \"via SealSend\". Full white-label is planned for the paid organizer plans." },
      { question: "Do my clients need an account?", answer: "No. A client opens the review link in a browser, sees the invitation and RSVP totals, and can approve it by typing their name. Links expire after 30 days and can be revoked at any time." },
      { question: "Does SealSend handle contracts, invoices or payments from clients?", answer: "No. SealSend covers the guest side of the event: invitations, RSVPs, updates and check-in. Use webhooks to send that data into the CRM or invoicing tool you already use." },
    ],
    ctaText: "Join the organizer beta",
    keywords: ["event planner software", "event planner client portal", "event planner client approval", "branded event invitations", "event planner RSVP tool"],
  },
  weddings: {
    slug: "weddings",
    name: "Weddings",
    image: "/brand/photos/weddings.webp",
    imageAlt: "Place cards sealed with red wax beside a navy welcome sign and a phone showing the wedding guest list",
    indexDescription: "One list for every reply, meal choice and plus-one, from the save-the-date to the welcome table.",
    indexFeatures: ["Wedding templates", "Plus-ones", "Meal and dietary questions", "Check-in"],
    metaTitle: "Wedding RSVP Website with Online Invitations",
    metaDescription: "Send your wedding invitation online, collect RSVPs with meal choices and plus-ones, message guests, and check them in at the door.",
    heroHeadline: "Every RSVP, meal choice and plus-one in one list.",
    heroSubtext: "Send a wedding invitation guests can open on any phone, collect the answers you need for the caterer, and keep the whole guest list in one place.",
    benefits: [
      { icon: "Palette", title: "Start from a wedding design", description: "Choose the Garden, City or Coastal wedding template, or upload your own invitation artwork, then add your photo and colours." },
      { icon: "ClipboardList", title: "Ask what the caterer needs", description: "Collect plus-ones and dietary needs, and add your own RSVP questions such as meal choice or song requests." },
      { icon: "Mail", title: "Keep guests in the loop", description: "Send a change of venue time or shuttle details by email to everyone or only to guests who said yes." },
      { icon: "Users", title: "Hand the door to someone else", description: "Invite a co-host to help with the list and let a friend check guests in from their phone on the day." },
    ],
    faqs: [
      { question: "How many guests can I invite?", answer: `${betaCapacityAnswer} Once paid plans open, an Event Pass covers one event with up to 250 guests.` },
      { question: "Do guests need an app or an account?", answer: "No. Guests open the invitation link in a browser and reply in a minute, with no download and no sign-up." },
      { question: "Can I import my guest list?", answer: "Yes. Upload a CSV with names, emails and phone numbers, or add guests one at a time." },
      { question: "Can guests tell me about allergies and plus-ones?", answer: "Yes. Turn on plus-ones and the dietary question, and add your own RSVP questions for anything else you need to know." },
    ],
    ctaText: "Start your wedding invitation",
    keywords: ["wedding RSVP website", "online wedding invitations", "wedding guest list", "wedding RSVP tracking"],
  },
  "birthday-parties": {
    slug: "birthday-parties",
    name: "Birthday parties",
    image: "/brand/photos/birthdays.webp",
    imageAlt: "A parent holding a phone that shows 18 kids coming, with children playing behind a backyard table set with a birthday cake",
    indexDescription: "Know how many are coming before you buy the cake, whether it's a backyard party or a milestone dinner.",
    indexFeatures: ["Birthday templates", "Headcount", "Updates by email", "Calendar links"],
    metaTitle: "Birthday Party Invitations with RSVP Tracking",
    metaDescription: "Send a birthday party invitation online, see a live headcount as replies come in, and update every guest at once if plans change.",
    heroHeadline: "Know how many kids are coming before you buy the cake.",
    heroSubtext: "Send one link to the class chat or the family group, watch the headcount fill in, and tell everyone at once if the party moves indoors.",
    benefits: [
      { icon: "Cake", title: "A party invitation in minutes", description: "Start from the Bold Birthday or Milestone Toast template, or upload your own design, and preview exactly what guests will see." },
      { icon: "Users", title: "A headcount you can trust", description: "See who's coming, who said maybe and who hasn't answered, including plus-ones, updated the moment a guest replies." },
      { icon: "Megaphone", title: "Rain plan? Tell everyone", description: "Send an update to every guest or only to those who said yes, so nobody turns up at the wrong place." },
      { icon: "Calendar", title: "Easy for guests to remember", description: "Guests can add the party to their calendar from the invitation, with the address and time already filled in." },
    ],
    faqs: [
      { question: "What does it cost?", answer: betaCapacityAnswer },
      { question: "Do parents need to sign up to reply?", answer: "No. They open the link in a browser and reply without an account or an app." },
      { question: "Can I share the invitation in a group chat?", answer: "Yes. Every event has a link you can paste anywhere, as well as email invitations." },
      { question: "Can guests bring siblings?", answer: "Yes. Turn on plus-ones and guests can tell you who else is coming when they reply." },
    ],
    ctaText: "Start a party invitation",
    keywords: ["birthday party invitations", "online birthday invitation with RSVP", "kids party RSVP", "birthday RSVP tracking"],
  },
};

export const LEGACY_USE_CASE_REDIRECTS: Record<string, keyof typeof USE_CASES> = {
  "baby-showers": "community-events",
  "corporate-events": "professional-gatherings",
};

export const USE_CASE_SLUGS = Object.keys(USE_CASES);
