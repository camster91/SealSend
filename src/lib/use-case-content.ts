export interface UseCaseData {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  heroHeadline: string;
  heroSubtext: string;
  benefits: {
    icon: string;
    title: string;
    description: string;
  }[];
  testimonial: {
    quote: string;
    name: string;
    role: string;
  };
  faqs: {
    question: string;
    answer: string;
  }[];
  ctaText: string;
  keywords: string[];
}

export const USE_CASES: Record<string, UseCaseData> = {
  weddings: {
    slug: "weddings",
    metaTitle:
      "Wedding Invitations Online — Free Digital Wedding Invites",
    metaDescription:
      "Create elegant digital wedding invitations, collect RSVPs, track meal choices, and manage your guest list — all in one beautiful platform. Free to start.",
    heroHeadline: "Elegant Digital Wedding Invitations",
    heroSubtext:
      "Set the tone for your big day with beautiful, personalized wedding invitations. Collect RSVPs, meal preferences, and plus-one details effortlessly.",
    benefits: [
      {
        icon: "Heart",
        title: "Stunning Designs",
        description:
          "Upload your own artwork or use customizable colors and backgrounds to match your wedding theme perfectly.",
      },
      {
        icon: "Users",
        title: "Guest List Management",
        description:
          "Track RSVPs, headcounts, meal choices, and dietary requirements from a single dashboard.",
      },
      {
        icon: "Share2",
        title: "Easy Sharing",
        description:
          "Share your invitation via email, text, WhatsApp, or a custom link — reach every guest on their preferred platform.",
      },
      {
        icon: "Calendar",
        title: "Calendar Integration",
        description:
          "Guests can add your wedding to their calendar in one click so nobody forgets the date.",
      },
    ],
    testimonial: {
      quote:
        "Seal and Send made our wedding planning so much easier. We saved money on postage and the RSVP tracking was incredibly helpful. Our guests loved the interactive invitation!",
      name: "Twyla Tyler",
      role: "Bride, Summer 2025",
    },
    faqs: [
      {
        question: "Can I customize the design to match my wedding theme?",
        answer:
          "Yes! You have full control over colors, backgrounds, logos, and images. Upload your own design or customize directly in Seal and Send to match your wedding palette.",
      },
      {
        question: "How do guests RSVP?",
        answer:
          "Guests click the link in their invitation and fill out a simple RSVP form. You can collect attendance, meal choices, dietary requirements, plus-one names, and more.",
      },
      {
        question: "Can I send reminders to guests who haven't responded?",
        answer:
          "Yes! You can send follow-up emails and announcements directly from Seal and Send to remind guests to RSVP.",
      },
      {
        question: "Is there a limit on the number of guests I can invite?",
        answer:
          "The Free plan includes 15 guest replies. The Standard plan ($5) supports 50 replies, and Premium ($10) allows up to 1,200 replies — plenty for even the largest weddings.",
      },
    ],
    ctaText: "Create Your Wedding Invitation",
    keywords: [
      "wedding invitations online",
      "digital wedding invites",
      "free wedding invitations",
      "wedding RSVP",
      "online wedding RSVP",
    ],
  },

  "baby-showers": {
    slug: "baby-showers",
    metaTitle:
      "Digital Baby Shower Invitations — Free Online Invites & RSVP",
    metaDescription:
      "Create adorable digital baby shower invitations. Collect RSVPs, share gift registry links, and coordinate everything in one place. Free to start.",
    heroHeadline: "Adorable Digital Baby Shower Invitations",
    heroSubtext:
      "Celebrate the newest arrival with charming invitations that delight your guests. Manage RSVPs, gift registries, and all the details in one place.",
    benefits: [
      {
        icon: "Baby",
        title: "Charming Designs",
        description:
          "Create invitations as sweet as your baby-to-be. Customize colors, upload photos, and add a personal touch.",
      },
      {
        icon: "Gift",
        title: "Gift Registry Links",
        description:
          "Add gift registry links directly to your invitation so guests can easily find and purchase the perfect gift.",
      },
      {
        icon: "ClipboardList",
        title: "Collect Guest Details",
        description:
          "Gather headcounts, dietary preferences, and any other info you need to plan the perfect shower.",
      },
      {
        icon: "Mail",
        title: "Email Invitations",
        description:
          "Send beautiful email invitations or share a custom link — perfect for reaching friends and family everywhere.",
      },
    ],
    testimonial: {
      quote:
        "The invitations looked gorgeous and everyone RSVP'd within a day! Adding the gift registry link was so convenient. Highly recommend for any mom-to-be.",
      name: "Monica W",
      role: "Mother-to-be",
    },
    faqs: [
      {
        question: "Can I add a gift registry link to the invitation?",
        answer:
          "Absolutely! Seal and Send lets you add gift registry links directly to your event page so guests can easily find your wishlist.",
      },
      {
        question: "Can I include a map or directions to the venue?",
        answer:
          "Yes! You can add location blocks with address details to your event page so guests know exactly where to go.",
      },
      {
        question: "Is it possible to track who has RSVP'd?",
        answer:
          "Yes! Your dashboard shows all responses in real-time, including who has accepted, declined, and who hasn't replied yet.",
      },
      {
        question: "Can I send the invitation to people who don't have email?",
        answer:
          "Yes! You can share your event via a custom link that works on any platform — text, WhatsApp, social media, or any messaging app.",
      },
    ],
    ctaText: "Create Your Baby Shower Invitation",
    keywords: [
      "baby shower invitations",
      "digital baby shower invites",
      "free baby shower invitations",
      "online baby shower RSVP",
      "baby shower planning",
    ],
  },

  "birthday-parties": {
    slug: "birthday-parties",
    metaTitle:
      "Birthday Party Invitations Online — Free Digital Invites",
    metaDescription:
      "Create fun, vibrant digital birthday party invitations. Collect RSVPs, manage your guest list, and make every birthday celebration unforgettable. Free to start.",
    heroHeadline: "Fun Digital Birthday Party Invitations",
    heroSubtext:
      "Make every birthday unforgettable with vibrant, personalized digital invitations. Track RSVPs and manage all the party details effortlessly.",
    benefits: [
      {
        icon: "Cake",
        title: "Vibrant Designs",
        description:
          "Create eye-catching invitations for any age — from first birthdays to milestone celebrations.",
      },
      {
        icon: "Music",
        title: "Add Music & Video",
        description:
          "Make your invitation interactive with music, slideshows, and video to set the party mood.",
      },
      {
        icon: "Users",
        title: "Headcount Tracking",
        description:
          "Know exactly how many guests are coming with real-time RSVP tracking and headcount details.",
      },
      {
        icon: "MapPin",
        title: "Venue Details",
        description:
          "Include location, time blocks, and all essential info so guests have everything they need.",
      },
    ],
    testimonial: {
      quote:
        "My daughter's birthday invitations were a huge hit! The video invitation feature blew everyone away. So much easier than paper invites and way more fun.",
      name: "Ashley Corbett",
      role: "Parent, kids' birthday party",
    },
    faqs: [
      {
        question: "Can I create video or animated birthday invitations?",
        answer:
          "Yes! Seal and Send lets you turn your design into a video or slideshow with music, making your birthday invitation truly stand out.",
      },
      {
        question:
          "Is this suitable for kids' birthday parties?",
        answer:
          "Absolutely! Seal and Send works great for kids' parties. Parents love the easy RSVP system and the ability to collect headcounts for party planning.",
      },
      {
        question: "Can guests RSVP for multiple people?",
        answer:
          "Yes! Guests can specify how many people they're bringing, including separate adult and child headcounts if you enable that option.",
      },
      {
        question: "Can I update the invitation after sending it?",
        answer:
          "Yes! If details change (like venue or time), you can update your event page and send an announcement to all guests.",
      },
    ],
    ctaText: "Create Your Birthday Invitation",
    keywords: [
      "birthday party invitations online",
      "digital birthday invites",
      "free birthday invitations",
      "birthday party RSVP",
      "kids birthday invitations",
    ],
  },

  "corporate-events": {
    slug: "corporate-events",
    metaTitle:
      "Corporate Event Invitations — Professional Digital Invites",
    metaDescription:
      "Create professional digital invitations for corporate events, conferences, galas, and team gatherings. Track RSVPs and manage attendees efficiently.",
    heroHeadline: "Professional Corporate Event Invitations",
    heroSubtext:
      "Impress attendees with polished, branded digital invitations. Manage RSVPs, collect attendee information, and coordinate every detail with ease.",
    benefits: [
      {
        icon: "Briefcase",
        title: "Brand Consistency",
        description:
          "Upload your company logo and use your brand colors for a cohesive, professional look across all communications.",
      },
      {
        icon: "BarChart3",
        title: "Attendee Analytics",
        description:
          "Track registration numbers, response rates, and attendee details in real-time from your dashboard.",
      },
      {
        icon: "Tag",
        title: "Guest Tags & Groups",
        description:
          "Organize attendees by department, VIP status, or custom tags for targeted communication.",
      },
      {
        icon: "Megaphone",
        title: "Announcements & Updates",
        description:
          "Send agenda updates, reminders, and important announcements to all attendees or specific groups.",
      },
    ],
    testimonial: {
      quote:
        "We used Seal and Send for our annual company gala and it streamlined everything. The branding options made it look incredibly professional, and tracking RSVPs was effortless.",
      name: "Brian Stuart",
      role: "Event Manager, Tech Corp",
    },
    faqs: [
      {
        question: "Can I use my company's branding on the invitations?",
        answer:
          "Yes! Upload your logo, set your brand colors, and add custom backgrounds. Standard and Premium plans also remove the Seal and Send branding for a fully professional look.",
      },
      {
        question: "Can I collect specific attendee information?",
        answer:
          "Absolutely! Customize your RSVP form to collect any information you need — dietary preferences, session selections, accessibility requirements, and more.",
      },
      {
        question: "Is there a way to send different invitations to different groups?",
        answer:
          "Yes! Use guest tags to organize attendees into groups, then send targeted announcements and updates to specific segments.",
      },
      {
        question: "How many attendees can I manage?",
        answer:
          "The Premium plan ($10/event) supports up to 1,200 replies — perfect for large corporate events, conferences, and galas.",
      },
    ],
    ctaText: "Create Your Corporate Invitation",
    keywords: [
      "corporate event invitations",
      "business event RSVP",
      "professional digital invitations",
      "conference invitations",
      "corporate event management",
    ],
  },
};

export const USE_CASE_SLUGS = Object.keys(USE_CASES);
