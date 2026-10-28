import { randomUUID } from 'crypto';
import { toWebp } from '@/lib/image-processor';
import { query } from '@/lib/db/client';
import { getBlobStore } from '@/lib/blob-store';
import { canReserveStorage, storageQuotaBytes } from '@/lib/storage';

const COMPRESS_MAX_EDGE = 2048;
const COMPRESS_QUALITY = 80;

export function validateMagicBytes(buffer: Buffer, contentType: string): boolean {
  const h = buffer.slice(0, 12);

  // Images — SVG intentionally disallowed (active content / XSS risk)
  if (contentType === 'image/jpeg') return h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF;
  if (contentType === 'image/png') return h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47;
  if (contentType === 'image/gif') return h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46;
  if (contentType === 'image/webp') return h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46;

  // Video
  if (contentType === 'video/mp4') return h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70;
  if (contentType === 'video/webm') return h[0] === 0x1A && h[1] === 0x45 && h[2] === 0xDF && h[3] === 0xA3;

  // Audio
  if (contentType === 'audio/mpeg') return (h[0] === 0xFF && (h[1] & 0xE0) === 0xE0) || (h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33);
  if (contentType === 'audio/wav') return h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46;
  if (contentType === 'audio/ogg') return h[0] === 0x4F && h[1] === 0x67 && h[2] === 0x67 && h[3] === 0x53;
  if (contentType === 'audio/mp4') return h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70;

  return false;
}

async function compressImage(buffer: Buffer<ArrayBuffer>, contentType: string): Promise<{ data: Buffer<ArrayBuffer>; ext: string; mime: string }> {
  // Skip GIFs — sharp can't handle animated GIFs well
  if (contentType === 'image/gif') {
    return { data: buffer, ext: 'gif', mime: contentType };
  }

  // Resize to fit the maximum dimensions (never enlarging) and use WebP for the best size/quality ratio
  const compressed = Buffer.from(await toWebp(buffer, { maxSize: COMPRESS_MAX_EDGE, quality: COMPRESS_QUALITY }));

  // Only use compressed if it's actually smaller
  if (compressed.length < buffer.length) {
    return { data: compressed as Buffer<ArrayBuffer>, ext: 'webp', mime: 'image/webp' };
  }

  return { data: buffer, ext: contentType.split('/')[1] || 'bin', mime: contentType };
}

/** Defaults to `{ query }` from @/lib/db/client; tests inject a fake. */
export interface UploadStoreDb {
  query: <T = unknown>(text: string, params?: unknown[]) => Promise<T[]>;
}

export type SaveImageResult =
  | { url: string; usedBytes: number; quotaBytes: number }
  | { error: 'quota'; usedBytes: number; quotaBytes: number }
  | { error: 'invalid' };

export async function saveImageForUser(
  userId: string,
  data: Buffer,
  opts: { mediaType: "image"; originalName: string; contentType: string },
  deps: StoreDeps = {},
): Promise<SaveImageResult> {
  if (!opts.contentType.startsWith("image/") || !validateMagicBytes(data, opts.contentType)) {
    return { error: "invalid" };
  }

  const compressed = await compressImage(Buffer.from(data) as Buffer<ArrayBuffer>, opts.contentType);

  // Sanitize the original filename: keep only safe characters
  const originalName = opts.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${randomUUID()}-${originalName}`;

  // If compression changed the extension, update the filename
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
  return storeBufferForUser(userId, compressed.data, `${nameWithoutExt}.${compressed.ext}`, opts.mediaType, deps);
}

export type StoreResult =
  | { url: string; usedBytes: number; quotaBytes: number }
  | { error: "quota"; usedBytes: number; quotaBytes: number };

export interface StoreDeps { db?: UploadStoreDb; uploadsDir?: string; privateFolder?: "social-private" }

/** Reserve quota and persist already-final bytes (used directly for video/audio). */
export async function storeBufferForUser(
  userId: string,
  buffer: Buffer,
  fileName: string,
  mediaType: "image" | "video" | "audio",
  deps: StoreDeps = {},
): Promise<StoreResult> {
  const finalFileName = fileName;
  const store = getBlobStore({ uploadsDir: deps.uploadsDir });
  const blobKey = `${userId}/${deps.privateFolder ? deps.privateFolder + "/" : ""}${finalFileName}`;

  const urlPath = `/uploads/${userId}/${deps.privateFolder ? deps.privateFolder + "/" : ""}${finalFileName}`;

  const db: UploadStoreDb = deps.db ?? { query };
  const usedSql = 'SELECT COALESCE(SUM(byte_size), 0) AS used FROM upload_assets WHERE user_id = $1';
  const [usageRows, planRows, paidEventRows] = await Promise.all([
    db.query<{ used: number }>(usedSql, [userId]),
    db.query<{ tier: string }>("SELECT tier FROM user_subscriptions WHERE user_id = $1 AND status IN ('active','trialing') ORDER BY updated_at DESC LIMIT 1", [userId]),
    db.query("SELECT 1 FROM events WHERE user_id = $1 AND tier <> 'free' LIMIT 1", [userId]),
  ]);
  const usedBytes = Number(usageRows[0]?.used ?? 0);
  const quotaBytes = storageQuotaBytes(planRows[0]?.tier ?? 'free', paidEventRows.length > 0);
  if (!canReserveStorage(usedBytes, buffer.length, quotaBytes)) {
    return { error: 'quota', usedBytes, quotaBytes };
  }
  try {
    await store.put(blobKey, buffer);
    // The quota is re-checked in the insert itself (no lock on D1): no row means a
    // concurrent upload used the space first.
    const inserted = await db.query(
      `INSERT INTO upload_assets (user_id, path, byte_size, media_type)
       SELECT $1, $2, $3, $4
       WHERE (SELECT COALESCE(SUM(byte_size), 0) FROM upload_assets WHERE user_id = $1) + $3 <= $5
       RETURNING id`,
      [userId, urlPath, buffer.length, mediaType, quotaBytes],
    );
    if (inserted.length === 0) {
      await store.delete(blobKey).catch(() => undefined);
      const nowUsed = Number((await db.query<{ used: number }>(usedSql, [userId]))[0]?.used ?? 0);
      return { error: 'quota', usedBytes: nowUsed, quotaBytes };
    }
    return { url: urlPath, usedBytes: usedBytes + buffer.length, quotaBytes };
  } catch (error) {
    await store.delete(blobKey).catch(() => undefined);
    console.error('[upload] Failed to reserve storage', error);
    throw error;
  }
}
