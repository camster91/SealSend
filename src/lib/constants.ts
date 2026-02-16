export const TIERS = {
  free: {
    name: "Free",
    tagline: "Get started",
    description:
      "Everything you need to create and send invites\u2014free forever.",
    price: 0,
    maxResponses: 15,
    replyLabel: "15 replies",
    stripePriceId: null,
    features: [
      { title: "15 guest replies", description: null },
      { title: "Unlimited events", description: null },
      { title: "Design, send & manage invites", description: null },
      { title: "Email invitations", description: null },
      { title: "Seal and Send branding shown", description: null },
    ],
  },
  standard: {
    name: "Standard",
    tagline: "Most popular",
    description:
      "More replies, guest tags, SMS invites, and no branding.",
    price: 5,
    maxResponses: 50,
    replyLabel: "50 replies",
    stripePriceId: process.env.STRIPE_STANDARD_PRICE_ID ?? null,
    badge: "Most popular",
    features: [
      { title: "50 guest replies", description: null },
      { title: "Remove Seal and Send branding", description: null },
      { title: "Guest tags", description: null },
      { title: "SMS invites", description: null },
      { title: "Announcements", description: null },
    ],
  },
  premium: {
    name: "Premium",
    tagline: "Full power",
    description:
      "Unlimited replies, sign-up board, and priority support.",
    price: 10,
    maxResponses: 1200,
    replyLabel: "Unlimited replies*",
    stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID ?? null,
    badge: "Best value",
    features: [
      { title: "Unlimited replies*", description: null },
      { title: "Remove Seal and Send branding", description: null },
      { title: "Guest tags & SMS invites", description: null },
      { title: "Announcements", description: null },
      { title: "Sign-up board", description: null },
      { title: "Priority support", description: null },
    ],
    footnote: "*Subject to our fair use policy of 1,200 guest replies.",
  },
} as const;

export type TierKey = keyof typeof TIERS;

export const DEFAULT_RSVP_FIELDS = [
  {
    field_name: "attendance",
    field_label: "Will you be attending?",
    field_type: "attendance" as const,
    is_required: true,
    is_enabled: true,
    sort_order: 0,
  },
  {
    field_name: "email",
    field_label: "Email Address",
    field_type: "email" as const,
    is_required: false,
    is_enabled: true,
    sort_order: 1,
  },
  {
    field_name: "headcount",
    field_label: "Total Guests (including yourself)",
    field_type: "number" as const,
    placeholder: "1",
    is_required: false,
    is_enabled: true,
    sort_order: 2,
  },
  {
    field_name: "adult_count",
    field_label: "Number of Adults",
    field_type: "number" as const,
    placeholder: "0",
    is_required: false,
    is_enabled: false,
    sort_order: 3,
  },
  {
    field_name: "child_count",
    field_label: "Number of Children",
    field_type: "number" as const,
    placeholder: "0",
    is_required: false,
    is_enabled: false,
    sort_order: 4,
  },
  {
    field_name: "meal_choice",
    field_label: "Meal Preference",
    field_type: "select" as const,
    options: ["No preference", "Vegetarian", "Vegan", "Gluten-free", "Halal", "Kosher"],
    is_required: false,
    is_enabled: false,
    sort_order: 5,
  },
  {
    field_name: "dietary",
    field_label: "Dietary Requirements",
    field_type: "text" as const,
    placeholder: "Any allergies or dietary needs?",
    is_required: false,
    is_enabled: false,
    sort_order: 6,
  },
  {
    field_name: "plus_one",
    field_label: "Names of Additional Guests",
    field_type: "text" as const,
    placeholder: "Enter names of your guests (one per line)",
    is_required: false,
    is_enabled: false,
    sort_order: 7,
  },
  {
    field_name: "message",
    field_label: "Message to Host",
    field_type: "text" as const,
    placeholder: "Leave a message for the host...",
    is_required: false,
    is_enabled: false,
    sort_order: 8,
  },
];

export const DEFAULT_CUSTOMIZATION = {
  primaryColor: "#7c3aed",
  backgroundColor: "#ffffff",
  backgroundImage: null as string | null,
  fontFamily: "Inter",
  buttonStyle: "rounded" as "rounded" | "pill" | "square",
  showCountdown: true,
  audioUrl: null as string | null,
  logoUrl: null as string | null,
};

export const FAQ_ITEMS = [
  {
    question: "What is included in the Free plan?",
    answer:
      "The Free plan includes all essential features to design, send, and manage your event invites. You can manage up to 15 guest replies per event at no cost. Your invitation will always collect all replies, even on the Free plan.",
  },
  {
    question: "How does per-event pricing work?",
    answer:
      "Each event starts on the Free tier. When you need more features or replies, you can upgrade that specific event to Standard ($5) or Premium ($10). The upgrade is a one-time payment per event\u2014no subscriptions.",
  },
  {
    question: "Can I upgrade an event after it\u2019s been created?",
    answer:
      "Yes! You can upgrade your event at any time from the event dashboard. All your existing data, responses, and settings will be preserved when you upgrade.",
  },
  {
    question: "Will I be charged in my local currency?",
    answer:
      "Prices are displayed in USD. Your payment provider may convert the amount to your local currency at the current exchange rate.",
  },
  {
    question: "What is counted as a reply?",
    answer:
      "A reply is counted each time a unique guest submits an RSVP response through your event page. Each guest submission counts as one reply, regardless of headcount.",
  },
  {
    question: "Can I downgrade or get a refund?",
    answer:
      "Event upgrades are one-time purchases per event and are non-refundable. However, you can always create new events on the Free plan.",
  },
  {
    question: "What features are unlocked with Standard?",
    answer:
      "Standard ($5/event) gives you 50 replies, removes Seal and Send branding, and unlocks guest tags, SMS invites, and announcements.",
  },
  {
    question: "What extra features does Premium include?",
    answer:
      "Premium ($10/event) includes everything in Standard plus unlimited replies (up to 1,200 fair use), a sign-up board for coordinating contributions, and priority support.",
  },
];

export const FEATURES_LIST = [
  {
    title: "Video and Slideshow invitations",
    subtitle: "Transform static designs dynamically",
    description:
      "Turn your design into a video or slideshow to create an interactive invitation. Engage your recipients with movement, storytelling, and audio.",
    icon: "Play",
  },
  {
    title: "Branded Invitations",
    subtitle: "Maintain brand consistency",
    description:
      "Customize your invitations with your logo, photos, and colors. Ensure cohesive branding across your designs and your invitation webpage.",
    icon: "Palette",
  },
  {
    title: "Customizable Page Colors",
    subtitle: "Match event theme perfectly",
    description:
      "Full control over page backgrounds and button colors to align your invitation with your theme or brand.",
    icon: "Paintbrush",
  },
  {
    title: "Custom Backgrounds and Logos",
    subtitle: "Add a personal touch",
    description:
      "Upload your logo and photos or use high-quality wallpapers to add unique flair to your event page.",
    icon: "Image",
  },
  {
    title: "Music and Sounds",
    subtitle: "Create immersive experiences",
    description:
      "Add music or audio to your video invitation, enhancing emotional impact and making the invitation engaging.",
    icon: "Music",
  },
  {
    title: "Email Builder Integration",
    subtitle: "Reach guests with ease",
    description:
      "Send pretty invite, update, and reminder emails via your own Gmail, Outlook, Yahoo or any other email client.",
    icon: "Mail",
  },
  {
    title: "Marketing Tools",
    subtitle: "Send professionally from your domain",
    description:
      "Easily transfer event assets to your email marketing provider and send your invitation out professionally.",
    icon: "Megaphone",
  },
  {
    title: "Shareable Links",
    subtitle: "Flexible sharing options",
    description:
      "Share your invitation via any chat app, text, iMessage or social platform making it easy for guests to receive and respond.",
    icon: "Share2",
  },
  {
    title: "Add Events to Calendars",
    subtitle: "Make attending convenient",
    description:
      "Recipients can sync events to their calendars in just one click, ensuring they won't miss the event.",
    icon: "Calendar",
  },
  {
    title: "Custom URLs",
    subtitle: "Create memorable links",
    description:
      "Generate a personalized, easy-to-share link for your event, making it more convenient for recipients.",
    icon: "Link",
  },
  {
    title: "Event Analytics",
    subtitle: "Gain guest engagement insights",
    description:
      "Track replies with easy-to-use mobile friendly dashboards, tables, and graphs, keeping you informed as you plan.",
    icon: "BarChart3",
  },
  {
    title: "Collect Recipient Info",
    subtitle: "Tailor event to guest needs",
    description:
      "Use customizable forms to gather meal choices and dietary preferences, making guests feel cared for.",
    icon: "ClipboardList",
  },
  {
    title: "Adult and Child Headcounts",
    subtitle: "Plan with precision",
    description:
      "Collect information to get accurate adult and child headcounts, ensuring proper resources for the event.",
    icon: "Users",
  },
  {
    title: "Guest Tags",
    subtitle: "Organize guest lists efficiently",
    description:
      "Group recipients by adding tags, making it easy to manage and communicate with specific groups.",
    icon: "Tag",
  },
  {
    title: "Location and Time Blocks",
    subtitle: "Provide essential details",
    description:
      "Add location and time details to your invitation webpage, ensuring recipients have all necessary information to attend.",
    icon: "MapPin",
  },
  {
    title: "Gift Registries",
    subtitle: "Make gifting effortless",
    description:
      "Add gift registry links to your invitation webpage, simplifying the gifting process for guests and enhancing their experience.",
    icon: "Gift",
  },
  {
    title: "AI EventScribe",
    subtitle: "Write compelling event details",
    description:
      "Use AI EventScribe to craft the perfect event description, ensuring your message is clear and engaging.",
    icon: "Sparkles",
  },
];
