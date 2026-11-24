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
  "SealSend is free during the beta: one active event at a time, with up to 100 guests. When an event is over, archive it and start the next one.";

export const USE_CASES: Record<string, UseCaseData> = {
  "birthday-parties": {
    slug: "birthday-parties",
    name: "Birthday parties",
    image: "/brand/photos/birthdays.webp",
    imageAlt: "A parent holding a phone that shows 18 kids coming, with children playing behind a backyard table set with a birthday cake",
    indexDescription: "Know how many are coming before you buy the cake.",
    indexFeatures: ["Headcount", "Plus-ones", "Allergies"],
    metaTitle: "Birthday Party Invitations with RSVP Tracking",
    metaDescription: "Make a birthday party invitation online, share the link in your group chat, and see a live headcount as replies come in.",
    heroHeadline: "Know how many kids are coming before you buy the cake.",
    heroSubtext: "Share one link in the class chat or the family group, then watch the headcount fill in.",
    benefits: [
      { icon: "Cake", title: "An invitation in minutes", description: "Pick a design, add your photo, and see exactly what guests will see before you share it." },
      { icon: "Users", title: "A headcount you can trust", description: "See who said yes, no or maybe, and who hasn't answered. Plus-ones are counted too." },
      { icon: "ClipboardList", title: "Ask about allergies", description: "Guests can tell you about allergies and who they're bringing when they reply." },
      { icon: "Calendar", title: "Easy to remember", description: "Guests can add the party to their calendar, with the time and address filled in." },
    ],
    faqs: [
      { question: "What does it cost?", answer: betaCapacityAnswer },
      { question: "Do parents need to sign up to reply?", answer: "No. They open the link and reply, with no account or app." },
      { question: "Can I share it in a group chat?", answer: "Yes. Every event has a link you can paste anywhere." },
      { question: "What if plans change?", answer: "Change the details on your event. The same link shows guests the new plan, so let them know to look again." },
    ],
    ctaText: "Start a party invitation",
    keywords: ["birthday party invitations", "online birthday invitation with RSVP", "kids party RSVP", "birthday RSVP tracking"],
  },
  "clubs-associations": {
    slug: "clubs-associations",
    name: "Clubs and community",
    image: "/brand/photos/community.webp",
    imageAlt: "Neighbours setting out dishes at a community potluck while an organizer checks the guest list on a tablet",
    indexDescription: "Potlucks, club nights, volunteer days and workshops, without the spreadsheet.",
    indexFeatures: ["Next-event setup", "Sign-up list", "Check-in"],
    metaTitle: "Club and Community Event Invitations with RSVP",
    metaDescription: "Run a club night, potluck, volunteer day or workshop with one link: replies, who brings what, and check-in at the door.",
    heroHeadline: "Run the monthly potluck without the spreadsheet.",
    heroSubtext: "For clubs, neighbours, volunteers and small groups who meet again and again.",
    benefits: [
      { icon: "Users", title: "One list of replies", description: "See who's coming, who can't make it and who hasn't answered, without searching the group chat." },
      { icon: "ClipboardList", title: "Who's bringing what", description: "Add a sign-up list for dishes, supplies or volunteer jobs." },
      { icon: "Share2", title: "Share the work", description: "Invite a co-host, or give a helper access to check people in at the door." },
      { icon: "Calendar", title: "Set up the next one faster", description: "Start the next event from the last one, choose a new schedule, and decide whether to keep the guest list." },
    ],
    faqs: [
      { question: "We meet every month. How many events can we run?", answer: betaCapacityAnswer },
      { question: "Do members need an account?", answer: "No. They open the link and reply, with no account or app." },
      { question: "Can several organizers help?", answer: "Yes. Invite co-hosts, or helpers who only check people in." },
      { question: "Can we sell tickets or collect donations?", answer: "No. SealSend is for invitations, replies and check-in." },
    ],
    ctaText: "Start a club event",
    keywords: ["club event RSVP", "community event invitations", "potluck sign up", "volunteer event RSVP"],
  },
  weddings: {
    slug: "weddings",
    name: "Weddings",
    image: "/brand/photos/weddings.webp",
    imageAlt: "Place cards sealed with red wax beside a navy welcome sign and a phone showing the wedding guest list",
    indexDescription: "Every reply, meal choice and plus-one in one list.",
    indexFeatures: ["Plus-ones", "Meal choices", "Check-in"],
    metaTitle: "Wedding RSVP Website with Online Invitations",
    metaDescription: "Share your wedding invitation online, collect replies with meal choices and plus-ones, and check guests in at the door.",
    heroHeadline: "Every reply, meal choice and plus-one in one list.",
    heroSubtext: "Share an invitation guests can open on any phone, and collect the answers your caterer needs.",
    benefits: [
      { icon: "Palette", title: "A design that feels like yours", description: "Choose a wedding design or upload your own invitation, then add your photo and colours." },
      { icon: "ClipboardList", title: "Ask what the caterer needs", description: "Collect plus-ones, dietary needs and your own questions, such as meal choice." },
      { icon: "BarChart3", title: "See who hasn't answered", description: "Your guest list shows every reply, so you know who to ask before the deadline." },
      { icon: "Users", title: "Hand the door to a friend", description: "Invite a co-host, and let someone check guests in from their phone on the day." },
    ],
    faqs: [
      { question: "How many guests can I invite?", answer: betaCapacityAnswer },
      { question: "Do guests need an app or an account?", answer: "No. They open the link and reply, with nothing to install." },
      { question: "Can I import my guest list?", answer: "Yes. Upload a CSV file, or add guests one at a time." },
      { question: "Can guests tell me about allergies and plus-ones?", answer: "Yes. Turn on those questions, and add your own." },
    ],
    ctaText: "Start your wedding invitation",
    keywords: ["wedding RSVP website", "online wedding invitations", "wedding guest list", "wedding RSVP tracking"],
  },
};

export const USE_CASE_SLUGS = Object.keys(USE_CASES);
