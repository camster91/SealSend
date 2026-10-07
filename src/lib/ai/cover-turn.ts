import { z } from "zod";
import { buildCoverPrompt, type CoverStyle } from "@/lib/ai/cover-prompt";
import type { CoverImageProvider } from "@/lib/ai/image-provider";

export const AI_COVER_DAILY_LIMIT = 3;
export const AI_COVER_WINDOW_SECONDS = 86400;
export const AI_COVER_TIMEOUT_MS = 90_000;

type Result = { status: number; json: unknown };

const LIMIT: Result = {
  status: 429,
  json: { error: "You've used today's 3 AI covers. Upload your own, or try again tomorrow.", code: "AI_COVER_LIMIT" },
};
const FAILED: Result = {
  status: 502,
  json: { error: "We couldn't make a cover right now. Try again, or upload your own.", code: "AI_FAILED" },
};
const REFUSED: Result = {
  status: 422,
  json: { error: "That description can't be used for a cover. Try different words.", code: "AI_REFUSED" },
};
const FULL: Result = { status: 413, json: { error: "Your upload space is full." } };

export const AI_COVER_UNAVAILABLE_RESPONSE: Result = {
  status: 503,
  json: { error: "AI covers aren't available right now.", code: "AI_UNAVAILABLE" },
};

export async function runCoverTurn(
  deps: {
    provider: CoverImageProvider;
    consume: () => Promise<{ success: boolean; remaining: number }>;
    save: (bytes: Buffer) => Promise<{ url: string } | { error: "quota" } | { error: "invalid" }>;
    timeoutMs: number;
  },
  input: { title: string; description?: string | null; style: CoverStyle; note?: string },
): Promise<Result> {
  const quota = await deps.consume();
  if (!quota.success) return LIMIT;

  const prompt = buildCoverPrompt(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  let generated;
  try {
    generated = await deps.provider.generate({ prompt, signal: controller.signal });
  } catch {
    // Deliberately drops the error: it may carry the prompt.
    return FAILED;
  } finally {
    clearTimeout(timer);
  }
  if ("refused" in generated) return REFUSED;

  let saved;
  try {
    saved = await deps.save(generated.bytes);
  } catch {
    return FAILED;
  }
  if ("error" in saved) return saved.error === "quota" ? FULL : FAILED;
  return { status: 200, json: { url: saved.url, remaining: quota.remaining } };
}

/** The eventId to permission-check, or null when absent or not a UUID (never reaches a UUID column). */
export function getCoverEventId(json: unknown): string | null {
  const value = typeof json === "object" && json !== null ? (json as { eventId?: unknown }).eventId : undefined;
  return z.string().uuid().safeParse(value).success ? (value as string) : null;
}
