import type { EventCustomization } from "@/types/database";

/** What a style sets. Media (logo, background image, music) is the host's own and never comes from a style. */
const STYLE_KEYS = [
  "primaryColor",
  "backgroundColor",
  "fontFamily",
  "buttonStyle",
  "showCountdown",
  "imageFit",
  "imagePosition",
] as const satisfies ReadonlyArray<keyof EventCustomization>;

/** Applies a style's colours, font, button style, countdown and image framing, keeping uploaded media. */
export function applyStyle(current: EventCustomization, style: Partial<EventCustomization>): EventCustomization {
  const next: EventCustomization = { ...current };
  for (const key of STYLE_KEYS) {
    if (style[key] !== undefined) Object.assign(next, { [key]: style[key] });
  }
  return next;
}

export const UPLOAD_FAILED = "That file didn't upload. Try a smaller file (max 10 MB for images, 50 MB for video).";
export const UPLOAD_SPACE_FULL = "Your upload space is full. Remove media you no longer use, then try again.";

/** Words for a failed upload: a 413 means the account's storage is full, not that the file is too big. */
export function uploadFailureMessage(status: number | undefined): string {
  return status === 413 ? UPLOAD_SPACE_FULL : UPLOAD_FAILED;
}
