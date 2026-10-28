import { getBinding } from "@/lib/runtime-bindings";
import { blobKeySegments, type BlobStore } from "@/lib/blob-store.shared";

interface R2Object { arrayBuffer(): Promise<ArrayBuffer> }
interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
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
export type { BlobStore } from "@/lib/blob-store.shared";
