import type { EventLayoutStyle, EventMotif } from "@/types/database";

export type EventTemplate = {
  id: string;
  name: string;
  category: "Wedding" | "Celebration" | "Business" | "Community";
  description: string;
  customization: {
    primaryColor: string;
    backgroundColor: string;
    backgroundImage: string;
    fontFamily: "Inter" | "Poppins" | "DM Sans" | "Georgia" | "Courier";
    displayFont: "Cormorant Garamond" | "Playfair Display" | "Fraunces" | "Libre Caslon Display" | "Poppins" | "Inter" | "DM Sans";
    layoutStyle: EventLayoutStyle;
    motif: EventMotif;
    themeId: string;
    buttonStyle: "rounded" | "pill" | "square";
    showCountdown: boolean;
    audioUrl: string;
    logoUrl: string;
  };
};

export const EVENT_TEMPLATES: EventTemplate[] = [
  { id: "garden-wedding", name: "Garden Wedding", category: "Wedding", description: "Soft botanical colours, arched framing, and classic serif headings.", customization: { primaryColor: "#496B50", backgroundColor: "#F7F4EC", backgroundImage: "", fontFamily: "DM Sans", displayFont: "Cormorant Garamond", layoutStyle: "arch", motif: "botanical", themeId: "garden-wedding", buttonStyle: "pill", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "city-wedding", name: "City Wedding", category: "Wedding", description: "Refined editorial monochrome with sharp typography.", customization: { primaryColor: "#1F2937", backgroundColor: "#FAF9F6", backgroundImage: "", fontFamily: "Inter", displayFont: "Playfair Display", layoutStyle: "editorial", motif: "frame", themeId: "city-wedding", buttonStyle: "square", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "coastal-wedding", name: "Coastal Wedding", category: "Wedding", description: "Airy sea-glass tones with arched cards and romantic display type.", customization: { primaryColor: "#155E75", backgroundColor: "#F0F9FA", backgroundImage: "", fontFamily: "DM Sans", displayFont: "Cormorant Garamond", layoutStyle: "arch", motif: "botanical", themeId: "coastal-wedding", buttonStyle: "pill", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "black-tie-gala", name: "Black-Tie Evening", category: "Wedding", description: "Champagne gold accents and celestial evening elegance.", customization: { primaryColor: "#854D0E", backgroundColor: "#FBF8F1", backgroundImage: "", fontFamily: "DM Sans", displayFont: "Libre Caslon Display", layoutStyle: "classic", motif: "celestial", themeId: "black-tie-gala", buttonStyle: "square", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "bold-birthday", name: "Bold Birthday", category: "Celebration", description: "Warm peach canvas with vibrant violet energy.", customization: { primaryColor: "#7C3AED", backgroundColor: "#FFF7ED", backgroundImage: "", fontFamily: "Poppins", displayFont: "Fraunces", layoutStyle: "classic", motif: "celestial", themeId: "bold-birthday", buttonStyle: "rounded", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "golden-hour-dinner", name: "Golden Hour Dinner", category: "Celebration", description: "Terracotta warmth and editorial serif typography for intimate dinners.", customization: { primaryColor: "#9A3412", backgroundColor: "#FDF6EE", backgroundImage: "", fontFamily: "DM Sans", displayFont: "Fraunces", layoutStyle: "editorial", motif: "botanical", themeId: "golden-hour-dinner", buttonStyle: "pill", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "milestone-toast", name: "Milestone Toast", category: "Celebration", description: "Deep merlot hues with framed stationery polish.", customization: { primaryColor: "#881337", backgroundColor: "#FFF5F7", backgroundImage: "", fontFamily: "DM Sans", displayFont: "Playfair Display", layoutStyle: "classic", motif: "monogram", themeId: "milestone-toast", buttonStyle: "pill", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "family-celebration", name: "Family Celebration", category: "Celebration", description: "Friendly sage styling for showers, reunions, and backyard gatherings.", customization: { primaryColor: "#166534", backgroundColor: "#F2FAF5", backgroundImage: "", fontFamily: "Inter", displayFont: "Fraunces", layoutStyle: "classic", motif: "botanical", themeId: "family-celebration", buttonStyle: "rounded", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "modern-business", name: "Modern Business", category: "Business", description: "Clean, executive layout for client and company events.", customization: { primaryColor: "#0F4C81", backgroundColor: "#F8FAFC", backgroundImage: "", fontFamily: "Inter", displayFont: "Inter", layoutStyle: "editorial", motif: "none", themeId: "modern-business", buttonStyle: "square", showCountdown: false, audioUrl: "", logoUrl: "" } },
  { id: "minimal-studio", name: "Minimal Studio", category: "Business", description: "Gallery-quiet monochrome for design talks, galleries, and launches.", customization: { primaryColor: "#18181B", backgroundColor: "#FFFFFF", backgroundImage: "", fontFamily: "DM Sans", displayFont: "Libre Caslon Display", layoutStyle: "minimal", motif: "none", themeId: "minimal-studio", buttonStyle: "square", showCountdown: false, audioUrl: "", logoUrl: "" } },
  { id: "client-appreciation", name: "Client Appreciation", category: "Business", description: "Polished navy presentation for dinners and VIP receptions.", customization: { primaryColor: "#1E3A8A", backgroundColor: "#F1F5FD", backgroundImage: "", fontFamily: "DM Sans", displayFont: "Playfair Display", layoutStyle: "classic", motif: "frame", themeId: "client-appreciation", buttonStyle: "rounded", showCountdown: false, audioUrl: "", logoUrl: "" } },
  { id: "product-launch", name: "Product Launch", category: "Business", description: "High-contrast studio aesthetic for launches and showcases.", customization: { primaryColor: "#5B21B6", backgroundColor: "#F7F4FF", backgroundImage: "", fontFamily: "Poppins", displayFont: "Poppins", layoutStyle: "minimal", motif: "none", themeId: "product-launch", buttonStyle: "square", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "workshop-day", name: "Workshop Day", category: "Business", description: "Clear information hierarchy for training and offsites.", customization: { primaryColor: "#075985", backgroundColor: "#F0F9FF", backgroundImage: "", fontFamily: "Inter", displayFont: "DM Sans", layoutStyle: "editorial", motif: "none", themeId: "workshop-day", buttonStyle: "rounded", showCountdown: false, audioUrl: "", logoUrl: "" } },
  { id: "community-night", name: "Community Night", category: "Community", description: "Warm amber styling for neighbourhood gatherings and mixers.", customization: { primaryColor: "#B45309", backgroundColor: "#FFFBEB", backgroundImage: "", fontFamily: "Inter", displayFont: "Fraunces", layoutStyle: "classic", motif: "celestial", themeId: "community-night", buttonStyle: "rounded", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "volunteer-drive", name: "Volunteer Drive", category: "Community", description: "Welcoming, action-oriented layout for community drives.", customization: { primaryColor: "#A16207", backgroundColor: "#FEFCE8", backgroundImage: "", fontFamily: "Inter", displayFont: "DM Sans", layoutStyle: "minimal", motif: "none", themeId: "volunteer-drive", buttonStyle: "rounded", showCountdown: true, audioUrl: "", logoUrl: "" } },
  { id: "neighbourhood-meetup", name: "Neighbourhood Meetup", category: "Community", description: "Fresh teal palette for local clubs, potlucks, and meetups.", customization: { primaryColor: "#0F766E", backgroundColor: "#F0FDFA", backgroundImage: "", fontFamily: "Poppins", displayFont: "Fraunces", layoutStyle: "classic", motif: "botanical", themeId: "neighbourhood-meetup", buttonStyle: "pill", showCountdown: true, audioUrl: "", logoUrl: "" } },
];

export function getEventTemplate(id: string | undefined): EventTemplate | undefined {
  return EVENT_TEMPLATES.find((template) => template.id === id);
}
