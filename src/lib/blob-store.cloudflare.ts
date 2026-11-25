import { getBinding } from "@/lib/runtime-bindings";
import { blobKeySegments, type BlobStore } from "@/lib/blob-store.shared";

interface R2ObjectMeta { size: number }
interface R2Object extends R2ObjectMeta {
  body: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
}
interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>): Promise<unknown>;
  get(key: string, options?: { range?: { offset: number; length?: number } }): Promise<R2Object | null>;
  head(key: string): Promise<R2ObjectMeta | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
}

function bucket(): R2Bucket {
  const found = getBinding<R2Bucket>("UPLOADS");
  if (!found) throw new Error("UPLOADS R2 binding is not configured");
  return found;
}
const safe = (key: string) => {
  const segments = blobKeySegments(key);
  if (!segments) throw new Error("Invalid upload key");
  return segments.join("/");
};

/** R2 store used by the Cloudflare Workers build. */
export function getBlobStore(): BlobStore {
  return {
    async put(key, data) {
      await bucket().put(safe(key), data);
    },
    async get(key) {
      const object = await bucket().get(safe(key));
      return object ? new Uint8Array(await object.arrayBuffer()) : null;
    },
    async getStream(key, range) {
      const normalized = safe(key);
      if (range) {
        const meta = await bucket().head(normalized);
        if (!meta) return null;
        const start = Math.max(0, range.start);
        const end = range.end !== undefined ? Math.min(meta.size - 1, range.end) : meta.size - 1;
        if (start >= meta.size || end < start) return null;
        const object = await bucket().get(normalized, { range: { offset: start, length: end - start + 1 } });
        if (!object) return null;
        return { body: object.body, size: meta.size, range: { start, end } };
      }
      const object = await bucket().get(normalized);
      if (!object) return null;
      return { body: object.body, size: object.size };
    },
    async head(key) {
      const meta = await bucket().head(safe(key));
      return meta ? { size: meta.size } : null;
    },
    async delete(key) {
      await bucket().delete(safe(key));
    },
    async deletePrefix(prefix) {
      const base = `${safe(prefix.replace(/\/+$/, ""))}/`;
      let cursor: string | undefined;
      do {
        const page = await bucket().list({ prefix: base, cursor });
        if (page.objects.length) await bucket().delete(page.objects.map((o) => o.key));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    },
  };
}
export { blobKeyFromUploadPath, blobKeySegments } from "@/lib/blob-store.shared";
export type { BlobStore, BlobStreamResult } from "@/lib/blob-store.shared";
