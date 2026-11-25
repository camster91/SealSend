export interface BlobStreamResult {
  body: ReadableStream<Uint8Array>;
  size: number;
  range?: { start: number; end: number };
}

/** Stores uploaded files by key (`<userId>/[social-private/]<file>`). */
export interface BlobStore {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  /** Streams a file (optionally a byte range) without buffering the full payload into RAM. */
  getStream?(key: string, range?: { start: number; end?: number }): Promise<BlobStreamResult | null>;
  /** Returns byte size without reading file contents (used for HEAD requests). */
  head?(key: string): Promise<{ size: number } | null>;
  /** Removes one file; a missing file is not an error. */
  delete(key: string): Promise<void>;
  /** Removes every file whose key starts with `prefix` (a directory such as `<userId>/`). */
  deletePrefix(prefix: string): Promise<void>;
}

export function blobKeySegments(key: string): string[] | null {
  const segments = key.split("/").filter((segment, index, all) => segment || index === all.length - 1);
  return segments.length > 0 && segments.every((s) => s && s !== "." && s !== ".." && !s.includes("\\") && !s.includes("\0")) ? segments : null;
}

/** Maps a public `/uploads/...` path to a blob key, or null if it is not a safe path. */
export function blobKeyFromUploadPath(uploadPath: string): string | null {
  if (!uploadPath.startsWith("/uploads/")) return null;
  const segments = blobKeySegments(uploadPath.slice("/uploads/".length));
  return segments ? segments.join("/") : null;
}
