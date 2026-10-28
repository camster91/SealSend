import { deflateSync } from "node:zlib";

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

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}

/** A solid-colour RGB PNG, built without an image library so it also runs on Workers. */
function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Test-only: a tiny deterministic PNG.
class FakeCoverImageProvider implements CoverImageProvider {
  async generate(): Promise<CoverImageResult> {
    return { bytes: solidPng(64, 43, [120, 90, 160]) };
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
