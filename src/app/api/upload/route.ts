import { NextRequest, NextResponse } from 'next/server';
import { requireApiHost } from '@/lib/auth/api-auth';
import { randomUUID } from 'crypto';
import { saveImageForUser, storeBufferForUser, validateMagicBytes, type StoreResult } from '@/lib/upload-store';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50MB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;  // 10MB

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
    const buffer: Buffer<ArrayBuffer> = Buffer.from(arrayBuffer);

    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: 'File content does not match declared type' },
        { status: 400 }
      );
    }

    const quotaResponse = (usedBytes: number, quotaBytes: number) =>
      NextResponse.json({ error: 'Storage quota exceeded. Remove unused media or upgrade your plan.', usedBytes, quotaBytes }, { status: 413 });

    let result: StoreResult;
    if (uploadType === 'image') {
      const saved = await saveImageForUser(user.id, buffer, { mediaType: 'image', originalName: file.name, contentType: file.type });
      if ('error' in saved && saved.error === 'invalid') {
        return NextResponse.json({ error: 'File content does not match declared type' }, { status: 400 });
      }
      result = saved as StoreResult;
    } else {
      // Video and audio are stored as uploaded (no compression)
      const finalExt = file.name.split('.').pop() || 'bin';
      const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const nameWithoutExt = `${Date.now()}-${randomUUID()}-${originalName}`.replace(/\.[^.]+$/, '');
      result = await storeBufferForUser(user.id, buffer, `${nameWithoutExt}.${finalExt}`, uploadType as 'video' | 'audio');
    }
    if ('error' in result) return quotaResponse(result.usedBytes, result.quotaBytes);
    return NextResponse.json({ url: result.url, storage: { usedBytes: result.usedBytes, quotaBytes: result.quotaBytes } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
