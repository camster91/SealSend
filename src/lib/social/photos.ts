import path from 'node:path';
import { unlink } from 'node:fs/promises';
import sharp from 'sharp';
import { query } from '@/lib/db/client';
import { saveImageForUser, validateMagicBytes } from '@/lib/upload-store';
import { resolveUploadPath } from '@/lib/upload-path';
import { socialTransaction } from './actions';
import { ensureSocialSchema } from './access';
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
    return await sharp(bytes, { limitInputPixels: 25000000 }).rotate().resize(1600,1600,{ fit:'inside',withoutEnlargement:true }).webp({ quality:80 }).toBuffer();
  } catch { return null; }
}
export async function saveSocialPhoto(access: SocialAccess, bytes: Buffer, caption: string): Promise<{ status: number; error?: string; id?: string }> {
  // Reserve the owner's quota before taking the event lock; never hold two
  // database transactions while waiting on separate pool connections.
  const settings = await getSocialSettings(access.event.id);
  if (!settings.photos_enabled) return { status:409,error:'The album is closed.' };
  const saved = await saveImageForUser(access.event.user_id,bytes,{ mediaType:'image',contentType:'image/webp',originalName:'guest-photo.webp' },{ privateFolder:'social-private' });
  if ('error' in saved) return { status:413,error:'The host’s upload space is full.' };
  let attached = false;
  try {
    const result = await socialTransaction(access.event.id, async db => {
      const current = await getSocialSettings(access.event.id, db);
      if (!current.photos_enabled) return { status:409,error:'The album is closed.' };
      const [counts] = await db<{ total: number; own: number }>('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE guest_id=$2)::int AS own FROM event_social_photos WHERE event_id=$1',[access.event.id,access.guest.id]);
      if (counts.total >= 200 || counts.own >= 10) return { status:413,error:'The photo limit has been reached.' };
      const [photo] = await db<{ id: string }>('INSERT INTO event_social_photos(event_id,guest_id,storage_path,caption,approved) VALUES ($1,$2,$3,$4,$5) RETURNING id',[access.event.id,access.guest.id,saved.url,caption,!current.photo_approval]);
      return { status:201,id:photo.id };
    });
    attached = result.status === 201;
    return result;
  } finally {
    if (!attached) await removePrivateFile(saved.url);
  }
}

export function privatePhotoPath(storagePath: string): string | null {
  if (!/^\/uploads\/[0-9a-f-]+\/social-private\/[A-Za-z0-9._-]+\.webp$/.test(storagePath)) return null;
  return resolveUploadPath(path.join(process.cwd(),'uploads'),storagePath.slice('/uploads/'.length).split('/'));
}
export async function removePrivateFile(storagePath: string): Promise<void> {
  const file = privatePhotoPath(storagePath);
  if (!file) return;
  await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await query('DELETE FROM upload_assets WHERE path=$1',[storagePath]);
  await query('DELETE FROM event_social_file_cleanup WHERE storage_path=$1',[storagePath]);
}
export async function deleteSocialPhoto(eventId: string, id: string, guestId: string | null, host: boolean): Promise<boolean> {
  const deleted = await socialTransaction(eventId, async db => {
    const [photo] = await db<{ storage_path: string }>('DELETE FROM event_social_photos WHERE event_id=$1 AND id=$2 AND (guest_id=$3 OR $4) RETURNING storage_path',[eventId,id,guestId,host]);
    return photo;
  });
  if (!deleted) return false;
  // An interrupted unlink leaves a quota-accounted orphan for the existing cleanup job.
  await removePrivateFile(deleted.storage_path).catch(() => undefined);
  return true;
}

/** Snapshot only authorized scope; database triggers preserve any concurrent deletes. */
export async function captureSocialPhotoPaths(eventId: string, guestId?: string): Promise<string[]> {
  await ensureSocialSchema();
  const rows = await query<{ storage_path:string }>('SELECT storage_path FROM event_social_photos WHERE event_id=$1 AND ($2::uuid IS NULL OR guest_id=$2)',[eventId,guestId ?? null]);
  return rows.map(row=>row.storage_path);
}
/** Explicit deletion retries run independently of optional orphan garbage collection. */
export async function purgeQueuedSocialPhotos(paths?: string[]): Promise<number> {
  const rows = await query<{ storage_path:string }>(`SELECT q.storage_path FROM event_social_file_cleanup q
    WHERE ($1::text[] IS NULL OR q.storage_path=ANY($1))
      AND NOT EXISTS (SELECT 1 FROM event_social_photos p WHERE p.storage_path=q.storage_path)
    ORDER BY queued_at LIMIT 200`,[paths ?? null]);
  let deleted = 0;
  for (const row of rows) {
    if (!privatePhotoPath(row.storage_path)) continue;
    try { await removePrivateFile(row.storage_path); deleted++; } catch { /* Keep queued for retry. */ }
  }
  return deleted;
}
