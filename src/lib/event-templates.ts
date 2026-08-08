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
];

export function getEventTemplate(id: string | undefined): EventTemplate | undefined {
  return EVENT_TEMPLATES.find((template) => template.id === id);
}
