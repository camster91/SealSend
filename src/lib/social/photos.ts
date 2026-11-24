import { toWebp } from '@/lib/image-processor';
import { batch, query } from '@/lib/db/client';
import { abortCode, guard } from '@/lib/db/sqlite-dialect';
import { saveImageForUser, validateMagicBytes } from '@/lib/upload-store';
import { blobKeyFromUploadPath, getBlobStore } from '@/lib/blob-store';
import type { SocialAccess } from './access';
import { getSocialSettings } from './store';
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export function canReadPhoto(approved: boolean, owner: string, guest: string | null, host: boolean): boolean {
  return host || approved || owner === guest;
}
export async function readBoundedBody(request: Request, max = MAX_PHOTO_BYTES + 65536): Promise<Buffer | null> {
  if (Number(request.headers.get('content-length')) > max || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks);
      size += value.length;
      if (size > max) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
}
export async function normalizePhoto(bytes: Buffer, contentType: string): Promise<Buffer | null> {
  if (!['image/jpeg','image/png','image/webp'].includes(contentType) || bytes.length > MAX_PHOTO_BYTES || !validateMagicBytes(bytes,contentType)) return null;
  try {
    return Buffer.from(await toWebp(bytes, { maxSize:1600,quality:80,autoRotate:true,limitInputPixels:25000000 }));
  } catch { return null; }
}
export async function saveSocialPhoto(access: SocialAccess, bytes: Buffer, caption: string): Promise<{ status: number; error?: string; id?: string }> {
  // Reserve the owner's quota first, then attach the photo in one batch whose
  // guards re-check the album and the photo limits when the insert runs.
  const settings = await getSocialSettings(access.event.id);
  if (!settings.photos_enabled) return { status:409,error:'The album is closed.' };
  const saved = await saveImageForUser(access.event.user_id,bytes,{ mediaType:'image',contentType:'image/webp',originalName:'guest-photo.webp' },{ privateFolder:'social-private' });
  if ('error' in saved) return { status:413,error:'The host’s upload space is full.' };
  let attached = false;
  try {
    let result: { status: number; error?: string; id?: string };
    try {
      const results = await batch<{ id: string }>([
        guard('COALESCE((SELECT photos_enabled FROM event_social_settings WHERE event_id=$1),0) = 1',[access.event.id],'album_closed'),
        guard('(SELECT COUNT(*) FROM event_social_photos WHERE event_id=$1) < 200 AND (SELECT COUNT(*) FROM event_social_photos WHERE event_id=$1 AND guest_id=$2) < 10',[access.event.id,access.guest.id],'photo_limit'),
        // Approval follows the current settings row (the guard above ensures it exists).
        { text:'INSERT INTO event_social_photos(event_id,guest_id,storage_path,caption,approved) SELECT $1,$2,$3,$4,(photo_approval = 0) FROM event_social_settings WHERE event_id=$1 RETURNING id',params:[access.event.id,access.guest.id,saved.url,caption] },
      ]);
      result = { status:201,id:results[2][0].id };
    } catch (error) {
      const code = abortCode(error);
      if (code === 'album_closed') result = { status:409,error:'The album is closed.' };
      else if (code === 'photo_limit') result = { status:413,error:'The photo limit has been reached.' };
      else throw error;
    }
    attached = result.status === 201;
    return result;
  } finally {
    if (!attached) await removePrivateFile(saved.url);
  }
}

export function privatePhotoPath(storagePath: string): string | null {
  if (!/^\/uploads\/[0-9a-f-]+\/social-private\/[A-Za-z0-9._-]+\.webp$/.test(storagePath)) return null;
  return blobKeyFromUploadPath(storagePath);
}
export async function removePrivateFile(storagePath: string): Promise<void> {
  const file = privatePhotoPath(storagePath);
  if (!file) return;
  await getBlobStore().delete(file);
  await query('DELETE FROM upload_assets WHERE path=$1',[storagePath]);
  await query('DELETE FROM event_social_file_cleanup WHERE storage_path=$1',[storagePath]);
}
export async function deleteSocialPhoto(eventId: string, id: string, guestId: string | null, host: boolean): Promise<boolean> {
  const [deleted] = await query<{ storage_path: string }>('DELETE FROM event_social_photos WHERE event_id=$1 AND id=$2 AND (guest_id=$3 OR $4 = 1) RETURNING storage_path',[eventId,id,guestId,host]);
  if (!deleted) return false;
  // An interrupted unlink leaves a quota-accounted orphan for the existing cleanup job.
  await removePrivateFile(deleted.storage_path).catch(() => undefined);
  return true;
}

/** Snapshot only authorized scope; database triggers preserve any concurrent deletes. */
export async function captureSocialPhotoPaths(eventId: string, guestId?: string): Promise<string[]> {
  const rows = await query<{ storage_path:string }>('SELECT storage_path FROM event_social_photos WHERE event_id=$1 AND ($2 IS NULL OR guest_id=$2)',[eventId,guestId ?? null]);
  return rows.map(row=>row.storage_path);
}
/** Explicit deletion retries run independently of optional orphan garbage collection. */
export async function purgeQueuedSocialPhotos(paths?: string[]): Promise<number> {
  const rows = await query<{ storage_path:string }>(`SELECT q.storage_path FROM event_social_file_cleanup q
    WHERE ($1 IS NULL OR q.storage_path IN (SELECT value FROM json_each($1)))
      AND NOT EXISTS (SELECT 1 FROM event_social_photos p WHERE p.storage_path=q.storage_path)
    ORDER BY queued_at LIMIT 200`,[paths ?? null]);
  let deleted = 0;
  for (const row of rows) {
    if (!privatePhotoPath(row.storage_path)) continue;
    try { await removePrivateFile(row.storage_path); deleted++; } catch { /* Keep queued for retry. */ }
  }
  return deleted;
}
