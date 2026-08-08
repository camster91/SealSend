export type EventTemplate = {
  id: string;
  name: string;
  category: "Wedding" | "Celebration" | "Business" | "Community";
  description: string;
  customization: {
    primaryColor: string;
    backgroundColor: string;
    backgroundImage: string;
    fontFamily: "Inter" | "Poppins" | "Georgia" | "Courier";
    buttonStyle: "rounded" | "pill" | "square";
    showCountdown: boolean;
    audioUrl: string;
    logoUrl: string;
  };
};

export const EVENT_TEMPLATES: EventTemplate[] = [
  { id: "garden-wedding", name: "Garden Wedding", category: "Wedding", description: "Soft botanical colours and classic typography.", customization: { primaryColor: "#496B50", backgroundColor: "#F7F4EC", backgroundImage: "", fontFamily: "Georgia", buttonStyle: "pill", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "bold-birthday", name: "Bold Birthday", category: "Celebration", description: "Bright, friendly styling for birthdays and milestones.", customization: { primaryColor: "#7C3AED", backgroundColor: "#FFF7ED", backgroundImage: "", fontFamily: "Poppins", buttonStyle: "rounded", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "modern-business", name: "Modern Business", category: "Business", description: "Clean, focused design for client and company events.", customization: { primaryColor: "#0F4C81", backgroundColor: "#F8FAFC", backgroundImage: "", fontFamily: "Inter", buttonStyle: "square", showCountdown: false, audioUrl: "", logoUrl: "" } },
  { id: "community-night", name: "Community Night", category: "Community", description: "Warm, accessible styling for local gatherings.", customization: { primaryColor: "#B45309", backgroundColor: "#FFFBEB", backgroundImage: "", fontFamily: "Inter", buttonStyle: "rounded", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "city-wedding", name: "City Wedding", category: "Wedding", description: "Refined monochrome styling for modern celebrations.", customization: { primaryColor: "#27272A", backgroundColor: "#FAFAFA", backgroundImage: "", fontFamily: "Georgia", buttonStyle: "square", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "coastal-wedding", name: "Coastal Wedding", category: "Wedding", description: "Airy ocean tones with comfortable contrast.", customization: { primaryColor: "#155E75", backgroundColor: "#ECFEFF", backgroundImage: "", fontFamily: "Georgia", buttonStyle: "pill", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "milestone-toast", name: "Milestone Toast", category: "Celebration", description: "Rich, celebratory colours for anniversaries and milestones.", customization: { primaryColor: "#9F1239", backgroundColor: "#FFF1F2", backgroundImage: "", fontFamily: "Poppins", buttonStyle: "pill", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "family-celebration", name: "Family Celebration", category: "Celebration", description: "Friendly styling for showers, reunions, and family events.", customization: { primaryColor: "#166534", backgroundColor: "#F0FDF4", backgroundImage: "", fontFamily: "Inter", buttonStyle: "rounded", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "client-appreciation", name: "Client Appreciation", category: "Business", description: "Polished presentation for dinners and client gatherings.", customization: { primaryColor: "#1E3A8A", backgroundColor: "#EFF6FF", backgroundImage: "", fontFamily: "Inter", buttonStyle: "rounded", showCountdown: false, audioUrl: "", logoUrl: "" } },
  { id: "product-launch", name: "Product Launch", category: "Business", description: "High-energy contrast for launches and showcases.", customization: { primaryColor: "#5B21B6", backgroundColor: "#F5F3FF", backgroundImage: "", fontFamily: "Poppins", buttonStyle: "square", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "workshop-day", name: "Workshop Day", category: "Business", description: "Clear information hierarchy for training and workshops.", customization: { primaryColor: "#075985", backgroundColor: "#F0F9FF", backgroundImage: "", fontFamily: "Inter", buttonStyle: "rounded", showCountdown: false, audioUrl: "", logoUrl: "" } },
  { id: "volunteer-drive", name: "Volunteer Drive", category: "Community", description: "Welcoming, action-oriented styling for volunteer events.", customization: { primaryColor: "#A16207", backgroundColor: "#FEFCE8", backgroundImage: "", fontFamily: "Inter", buttonStyle: "rounded", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "neighbourhood-meetup", name: "Neighbourhood Meetup", category: "Community", description: "Simple and approachable for local groups and clubs.", customization: { primaryColor: "#0F766E", backgroundColor: "#F0FDFA", backgroundImage: "", fontFamily: "Poppins", buttonStyle: "pill", showCountdown: true, audioUrl: "", logoUrl: "" } },
];

export function getEventTemplate(id: string | undefined): EventTemplate | undefined {
  return EVENT_TEMPLATES.find((template) => template.id === id);
}
