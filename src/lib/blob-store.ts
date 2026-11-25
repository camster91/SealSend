import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { resolveUploadPath } from "@/lib/upload-path";
import { blobKeySegments, type BlobStore } from "@/lib/blob-store.shared";

export { blobKeyFromUploadPath, blobKeySegments } from "@/lib/blob-store.shared";
export type { BlobStore, BlobStreamResult } from "@/lib/blob-store.shared";


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
    async getStream(key, range) {
      const file = resolve(key);
      try {
        const info = await stat(file);
        const size = info.size;
        if (range) {
          const start = Math.max(0, range.start);
          const end = range.end !== undefined ? Math.min(size - 1, range.end) : size - 1;
          if (start >= size || end < start) return null;
          const nodeStream = createReadStream(file, { start, end });
          return {
            body: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
            size,
            range: { start, end },
          };
        }
        const nodeStream = createReadStream(file);
        return {
          body: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
          size,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async head(key) {
      try {
        const info = await stat(resolve(key));
        return { size: info.size };
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
