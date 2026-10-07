import type { SaveStatus } from "./save-machine";

/** Wait for persisted details before spending a generation attempt. */
export async function prepareCoverDraft(ctx: {
  ensureDraft(): Promise<string>;
  flush(): Promise<SaveStatus>;
}): Promise<string> {
  const id = await ctx.ensureDraft();
  const status = await ctx.flush();
  if (status.kind !== "idle" && status.kind !== "saved") {
    throw new Error("Save your event details before making a cover.");
  }
  return id;
}

export type CoverStyle = "elegant" | "playful" | "watercolor" | "photo" | "minimal";

export const COVER_STYLES: ReadonlyArray<{ value: CoverStyle; label: string }> = [
  { value: "elegant", label: "Elegant" },
  { value: "playful", label: "Playful" },
  { value: "watercolor", label: "Watercolor" },
  { value: "photo", label: "Photo-style" },
  { value: "minimal", label: "Minimal" },
];

export const COVER_LIMIT = "You've used today's 3 AI covers. Upload your own, or try again tomorrow.";
export const COVER_FAILED = "We couldn't make a cover right now. Try again, or upload your own.";
export const COVER_REFUSED = "That description can't be used for a cover. Try different words.";
export const COVER_SPACE_FULL = "Your upload space is full.";

/** Words for a failed generation. A 413 has no code, so it is read from the status. */
export function coverFailureMessage(status: number | undefined, code: string | undefined): string {
  if (status === 413) return COVER_SPACE_FULL;
  if (code === "AI_COVER_LIMIT") return COVER_LIMIT;
  if (code === "AI_REFUSED") return COVER_REFUSED;
  return COVER_FAILED;
}
