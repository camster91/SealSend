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
// Whitespace and control characters collapse to single spaces so host text cannot forge prompt lines.
// Written without regex escapes on purpose: checked per character.
function oneLine(text: string): string {
  let out = "";
  let gap = false;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 31 || code === 127 || ch.trim() === "") { gap = true; continue; }
    if (gap && out) out += " ";
    gap = false;
    out += ch === "“" || ch === "”" || ch === '"' ? "'" : ch;
  }
  return out;
}

function quoted(text: string, max: number): string {
  return `"${oneLine(text).slice(0, max).trim()}"`;
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
