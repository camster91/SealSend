import sharp from "sharp";

export type CoverImageResult = { bytes: Buffer } | { refused: true };

export interface CoverImageProvider {
  generate(input: { prompt: string; signal: AbortSignal }): Promise<CoverImageResult>;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const REFUSAL = /moderation|content_policy|safety/i;

async function fetchCapped(url: string, signal: AbortSignal): Promise<Buffer> {
  let protocol = "";
  try { protocol = new URL(url).protocol; } catch { /* fall through */ }
  if (protocol !== "https:") throw new Error("AI image url is not https");
  const response = await fetch(url, { signal, redirect: "error" });
  if (!response.ok) throw new Error(`AI image download returned ${response.status}`);
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_IMAGE_BYTES) throw new Error("AI image is too large");
  if (!response.body) throw new Error("AI image download had no body");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("AI image is too large");
    }
    chunks.push(Buffer.from(value));
  }
  if (total === 0) throw new Error("AI image download was empty");
  return Buffer.concat(chunks);
}

class OpenAiCoverImageProvider implements CoverImageProvider {
  async generate(input: { prompt: string; signal: AbortSignal }): Promise<CoverImageResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.AI_IMAGE_MODEL;
    if (!apiKey || !model) throw new Error("AI image provider is not configured");
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", signal: input.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: input.prompt, size: "1536x1024", n: 1 }),
    });
    if (!response.ok) {
      if (response.status === 400) {
        const body = await response.json().catch(() => null) as { error?: { code?: unknown; type?: unknown } } | null;
        const code = typeof body?.error?.code === "string" ? body.error.code : "";
        const type = typeof body?.error?.type === "string" ? body.error.type : "";
        if (REFUSAL.test(code) || REFUSAL.test(type)) return { refused: true };
      }
      // Status only: provider error text can echo the prompt, which is never logged.
      throw new Error(`AI image provider returned ${response.status}`);
    }
    const payload = await response.json().catch(() => {
      throw new Error("AI image provider returned an unreadable response");
    }) as { data?: Array<{ b64_json?: string; url?: string }> };
    const item = payload.data?.[0];
    if (item?.b64_json) {
      const bytes = Buffer.from(item.b64_json, "base64");
      if (bytes.length === 0) throw new Error("AI image provider returned an empty image");
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error("AI image is too large");
      return { bytes };
    }
    if (item?.url) return { bytes: await fetchCapped(item.url, input.signal) };
    throw new Error("AI image provider returned no image");
  }
}

// Test-only: a tiny deterministic PNG.
class FakeCoverImageProvider implements CoverImageProvider {
  async generate(): Promise<CoverImageResult> {
    const bytes = await sharp({ create: { width: 64, height: 43, channels: 3, background: { r: 120, g: 90, b: 160 } } }).png().toBuffer();
    return { bytes };
  }
}

export function isAiCoverConfigured(): boolean {
  const provider = process.env.AI_PROVIDER || "openai";
  if (provider === "fake") return true;
  if (provider !== "openai") return false;
  return Boolean(process.env.OPENAI_API_KEY && process.env.AI_IMAGE_MODEL);
}

export function getCoverImageProvider(): CoverImageProvider {
  const provider = process.env.AI_PROVIDER || "openai";
  if (provider === "fake") return new FakeCoverImageProvider();
  if (provider === "openai") return new OpenAiCoverImageProvider();
  throw new Error(`Unsupported AI provider: ${provider}`);
}
