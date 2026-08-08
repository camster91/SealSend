import type { AiEventDraft } from "@/lib/ai/event-draft-schema";

export function buildFallbackEventDraft(prompt: string, timezone: string): AiEventDraft {
  const clean = prompt.replace(/\s+/g, " ").trim();
  const capacity = clean.match(/\b(\d{1,4})\s+(?:people|guests|attendees)\b/i);
  const dressCode = clean.match(/\b(business casual|smart casual|formal|casual|black tie)\b/i)?.[1] ?? null;
  const titleSeed = clean.split(/[.!?]/)[0].replace(/\bfor\s+\d{1,4}\s+(?:people|guests|attendees)\b.*$/i, "").trim();
  const title = (titleSeed || "New Event").slice(0, 200);
  return {
    schemaVersion: "1.0",
    event: {
      title,
      description: clean.slice(0, 2000),
      eventDate: null,
      eventEndDate: null,
      eventTimezone: timezone,
      locationName: null,
      locationAddress: null,
      hostName: null,
      dressCode,
      rsvpDeadline: null,
      maxAttendees: capacity ? Number(capacity[1]) : null,
      allowPlusOnes: false,
      maxGuestsPerRsvp: 1,
    },
    rsvpFields: [{ key: "dietary_requirements", label: "Do you have any dietary requirements?", type: "text", required: false, options: [] }],
    invitation: { headline: title, body: clean.slice(0, 2000), tone: /business|client|corporate/i.test(clean) ? "professional" : "warm" },
    reminders: [],
    theme: { style: "modern and welcoming", primaryColor: "#6366F1", backgroundColor: "#FFFFFF", imageDirection: "Create an accessible event invitation background without embedded text." },
    missingInformation: ["event.eventDate", "event.locationName"],
    assumptions: [
      { field: "event.allowPlusOnes", value: "false", reason: "Plus-ones were not explicitly confirmed.", requiresConfirmation: true },
      { field: "event.maxGuestsPerRsvp", value: "1", reason: "Party size was not explicitly confirmed.", requiresConfirmation: true },
    ],
  };
}
