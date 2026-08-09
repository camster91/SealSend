import { NextRequest, NextResponse } from 'next/server';
import { requireApiHost } from '@/lib/auth/api-auth';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { getDb } from '@/lib/db/client';
import { canReserveStorage, storageQuotaBytes } from '@/lib/storage';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50MB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;  // 10MB

const COMPRESS_MAX_WIDTH = 2048;
const COMPRESS_MAX_HEIGHT = 2048;
const COMPRESS_QUALITY = 80;

function validateMagicBytes(buffer: Buffer, contentType: string): boolean {
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

  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Resize if larger than max dimensions
  const needsResize =
    (metadata.width && metadata.width > COMPRESS_MAX_WIDTH) ||
    (metadata.height && metadata.height > COMPRESS_MAX_HEIGHT);

  if (needsResize) {
    image.resize(COMPRESS_MAX_WIDTH, COMPRESS_MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Compress to WebP for best size/quality ratio
  const compressed = await image.webp({ quality: COMPRESS_QUALITY }).toBuffer();

  // Only use compressed if it's actually smaller
  if (compressed.length < buffer.length) {
    return { data: compressed as Buffer<ArrayBuffer>, ext: 'webp', mime: 'image/webp' };
  }

  return { data: buffer, ext: contentType.split('/')[1] || 'bin', mime: contentType };
}

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    const { rateLimit } = await import('@/lib/rate-limit');
    const { success: rateLimitOk } = await rateLimit(`upload:${user.id}`, {
      max: 30,
      windowSeconds: 3600,
    });
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        { status: 429 }
      );
    }

    const requestedType = request.nextUrl.searchParams.get('type') || 'image';
    const uploadType = ['image', 'video', 'audio'].includes(requestedType) ? requestedType : 'image';
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Determine allowed types and size limit based on upload type
    let allowedTypes: string[];
    let maxSize: number;
    let typeLabel: string;

    switch (uploadType) {
      case 'video':
        allowedTypes = VIDEO_TYPES;
        maxSize = MAX_VIDEO_SIZE;
        typeLabel = 'MP4 or WebM';
        break;
      case 'audio':
        allowedTypes = AUDIO_TYPES;
        maxSize = MAX_AUDIO_SIZE;
        typeLabel = 'MP3, WAV, OGG, or M4A';
        break;
      default:
        allowedTypes = IMAGE_TYPES;
        maxSize = MAX_IMAGE_SIZE;
        typeLabel = 'JPEG, PNG, GIF, or WebP';
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${typeLabel}` },
        { status: 400 }
      );
    }

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer<ArrayBuffer> = Buffer.from(arrayBuffer);

    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: 'File content does not match declared type' },
        { status: 400 }
      );
    }

    // Compress images (not videos or audio)
    let finalExt = file.name.split('.').pop() || 'bin';
    let _finalMime = file.type;

    if (uploadType === 'image' || (!['video', 'audio'].includes(uploadType) && IMAGE_TYPES.includes(file.type))) {
      const result = await compressImage(buffer, file.type);
      buffer = result.data;
      finalExt = result.ext;
      _finalMime = result.mime;
    }

    // Sanitize the original filename: keep only safe characters
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${randomUUID()}-${originalName}`;

    // If compression changed the extension, update the filename
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
    const finalFileName = `${nameWithoutExt}.${finalExt}`;

    const userDir = path.join(UPLOADS_DIR, user.id);
    const filePath = path.join(userDir, finalFileName);

    // Ensure the user's upload directory exists
    await mkdir(userDir, { recursive: true });

    const urlPath = `/uploads/${user.id}/${finalFileName}`;

    const db = getDb();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload:${user.id}`]);
      const [usageResult, planResult, paidEventResult] = await Promise.all([
        client.query<{ used: string }>('SELECT COALESCE(SUM(byte_size), 0)::text AS used FROM upload_assets WHERE user_id = $1', [user.id]),
        client.query<{ tier: string }>("SELECT tier FROM user_subscriptions WHERE user_id = $1 AND status IN ('active','trialing') ORDER BY updated_at DESC LIMIT 1", [user.id]),
        client.query("SELECT 1 FROM events WHERE user_id = $1 AND tier <> 'free' LIMIT 1", [user.id]),
      ]);
      const usedBytes = Number(usageResult.rows[0]?.used ?? 0);
      const quotaBytes = storageQuotaBytes(planResult.rows[0]?.tier ?? 'free', Boolean(paidEventResult.rowCount));
      if (!canReserveStorage(usedBytes, buffer.length, quotaBytes)) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Storage quota exceeded. Remove unused media or upgrade your plan.', usedBytes, quotaBytes }, { status: 413 });
      }
      await writeFile(filePath, buffer);
      await client.query(
        'INSERT INTO upload_assets (user_id, path, byte_size, media_type) VALUES ($1, $2, $3, $4)',
        [user.id, urlPath, buffer.length, uploadType],
      );
      await client.query('COMMIT');
      return NextResponse.json({ url: urlPath, storage: { usedBytes: usedBytes + buffer.length, quotaBytes } });
    } catch (error) {
      await client.query('ROLLBACK');
      await unlink(filePath).catch(() => undefined);
      console.error('[upload] Failed to reserve storage', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
