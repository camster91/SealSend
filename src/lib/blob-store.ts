import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveUploadPath } from "@/lib/upload-path";
import { blobKeySegments, type BlobStore } from "@/lib/blob-store.shared";

export { blobKeyFromUploadPath, blobKeySegments } from "@/lib/blob-store.shared";
export type { BlobStore } from "@/lib/blob-store.shared";


/** Filesystem store used by Docker/Node deployments. */
export function getBlobStore(options: { uploadsDir?: string } = {}): BlobStore {
  const base = options.uploadsDir ?? path.join(process.cwd(), "uploads");
  const resolve = (key: string) => {
    const segments = blobKeySegments(key);
    const resolved = segments && resolveUploadPath(base, segments);
    if (!resolved) throw new Error("Invalid upload key");
    return resolved;
  };
  return {
    async put(key, data) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(resolve(key)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      await unlink(resolve(key)).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    },
    async deletePrefix(prefix) {
      await rm(resolve(prefix.replace(/\/+$/, "")), { recursive: true, force: true });
    },
  };
}
