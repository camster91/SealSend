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
/** Failures after the quota was spent carry the count left, so the panel never shows a stale number. */
const failed = (remaining: number): Result => ({
  status: 502,
  json: { error: "We couldn't make a cover right now. Try again, or upload your own.", code: "AI_FAILED", remaining },
});
const refused = (remaining: number): Result => ({
  status: 422,
  json: { error: "That description can't be used for a cover. Try different words.", code: "AI_REFUSED", remaining },
});
const full = (remaining: number): Result => ({
  status: 413,
  json: { error: "Your upload space is full.", remaining },
});

export type CoverContentType = "image/png" | "image/jpeg" | "image/webp";

/** Reads the real format from the leading bytes; null when it is none of the three we accept. */
export function detectImageType(bytes: Uint8Array): CoverContentType | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 4 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "image/png";
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50
  ) return "image/webp";
  return null;
}

export const AI_COVER_UNAVAILABLE_RESPONSE: Result = {
  status: 503,
  json: { error: "AI covers aren't available right now.", code: "AI_UNAVAILABLE" },
};

export async function runCoverTurn(
  deps: {
    provider: CoverImageProvider;
    consume: () => Promise<{ success: boolean; remaining: number }>;
    save: (bytes: Buffer, contentType: CoverContentType) => Promise<{ url: string } | { error: "quota" } | { error: "invalid" }>;
    timeoutMs: number;
    /** The caller going away (client disconnect) also cancels the provider call. */
    signal?: AbortSignal;
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
    const signal = deps.signal ? AbortSignal.any([deps.signal, controller.signal]) : controller.signal;
    generated = await deps.provider.generate({ prompt, signal });
  } catch {
    // Deliberately drops the error: it may carry the prompt.
    return failed(quota.remaining);
  } finally {
    clearTimeout(timer);
  }
  if ("refused" in generated) return refused(quota.remaining);

  const contentType = detectImageType(generated.bytes);
  if (!contentType) return failed(quota.remaining);

  let saved;
  try {
    saved = await deps.save(generated.bytes, contentType);
  } catch {
    return failed(quota.remaining);
  }
  if ("error" in saved) return saved.error === "quota" ? full(quota.remaining) : failed(quota.remaining);
  return { status: 200, json: { url: saved.url, remaining: quota.remaining } };
}

/** The eventId to permission-check, or null when absent or not a UUID (never reaches a UUID column). */
export function getCoverEventId(json: unknown): string | null {
  const value = typeof json === "object" && json !== null ? (json as { eventId?: unknown }).eventId : undefined;
  return z.string().uuid().safeParse(value).success ? (value as string) : null;
}
