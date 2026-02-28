import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { nanoid } from 'nanoid';
import sharp from 'sharp';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
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

  // Images
  if (contentType === 'image/jpeg') return h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF;
  if (contentType === 'image/png') return h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47;
  if (contentType === 'image/gif') return h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46;
  if (contentType === 'image/webp') return h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46;
  if (contentType === 'image/svg+xml') {
    // Basic SVG validation: must start with XML or SVG tag, reject script tags
    const text = buffer.slice(0, 1024).toString('utf-8').toLowerCase();
    if (text.includes('<script') || text.includes('javascript:') || text.includes('onerror') || text.includes('onload')) {
      return false;
    }
    return text.includes('<svg') || text.includes('<?xml');
  }

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
  // Skip SVGs — they're already tiny and not raster
  if (contentType === 'image/svg+xml') {
    return { data: buffer, ext: 'svg', mime: contentType };
  }

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

export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uploadType = request.nextUrl.searchParams.get('type') || 'image';
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
        typeLabel = 'JPEG, PNG, GIF, WebP, or SVG';
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
    let finalMime = file.type;

    if (uploadType === 'image' || (!['video', 'audio'].includes(uploadType) && IMAGE_TYPES.includes(file.type))) {
      const result = await compressImage(buffer, file.type);
      buffer = result.data;
      finalExt = result.ext;
      finalMime = result.mime;
    }

    const fileName = `${nanoid()}.${finalExt}`;
    const filePath = `${user.id}/${fileName}`;

    const adminSupabase = createAdminClient();

    const { error: uploadError } = await adminSupabase.storage
      .from('event-designs')
      .upload(filePath, buffer, {
        contentType: finalMime,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = adminSupabase.storage
      .from('event-designs')
      .getPublicUrl(filePath);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
