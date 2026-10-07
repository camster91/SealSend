import { z } from "zod";

export const COVER_STYLES = ["elegant", "playful", "watercolor", "photo", "minimal"] as const;
export type CoverStyle = (typeof COVER_STYLES)[number];

const STYLE_PHRASES: Record<CoverStyle, string> = {
  elegant: "elegant, refined design with soft lighting",
  playful: "bright, playful illustration",
  watercolor: "soft watercolor illustration",
  photo: "realistic photograph",
  minimal: "minimal, clean graphic design with lots of space",
};

const RULES = "No text, letters, numbers, words or logos anywhere in the image. No recognisable real people or celebrities. Suitable for all ages.";

export const coverRequestSchema = z.object({
  eventId: z.uuid(),
  style: z.enum(COVER_STYLES),
  note: z.string().trim().max(300).optional(),
});

// Host text is data, not instructions: it is capped, quoted and placed before the fixed rules.
function quoted(text: string, max: number): string {
  return `"${text.trim().slice(0, max).replaceAll('"', "'")}"`;
}

export function buildCoverPrompt(input: { title: string; description?: string | null; style: CoverStyle; note?: string }): string {
  const parts = [
    `A wide cover image for an event invitation. Style: ${STYLE_PHRASES[input.style]}.`,
    `Event title: ${quoted(input.title, 200)}.`,
  ];
  if (input.description?.trim()) parts.push(`Event description: ${quoted(input.description, 300)}.`);
  if (input.note?.trim()) parts.push(`Extra detail from the host: ${quoted(input.note, 300)}.`);
  parts.push(RULES);
  return parts.join(" ");
}
