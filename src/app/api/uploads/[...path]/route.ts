import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { blobKeySegments, getBlobStore } from '@/lib/blob-store';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
};

function parseByteRange(header: string | null): { start: number; end?: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : undefined;
  if (!Number.isSafeInteger(start) || (end !== undefined && (!Number.isSafeInteger(end) || end < start))) {
    return null;
  }
  return { start, end };
}

async function resolvePublicUpload(params: Promise<{ path: string[] }>): Promise<{ key: string; contentType: string } | null> {
  const { path: segments } = await params;

  if (!segments || segments.length === 0 || segments.some((segment) => segment.includes('/') || segment.includes('\\'))) {
    return null;
  }

  const normalized = blobKeySegments(segments.join('/'));
  if (!normalized || normalized.includes('social-private')) {
    return null;
  }
  const key = normalized.join('/');

  const ext = path.extname(key).toLowerCase();

  // Never serve SVG as active content
  if (ext === '.svg' || ext === '.svgz' || ext === '.html' || ext === '.htm' || ext === '.js') {
    return null;
  }

  return { key, contentType: MIME_TYPES[ext] || 'application/octet-stream' };
}

function baseHeaders(contentType: string, contentLength: number): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Content-Length': String(contentLength),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  };
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolved = await resolvePublicUpload(params);
    if (!resolved) return new NextResponse(null, { status: 404 });
    const store = getBlobStore();
    if (store.head) {
      const meta = await store.head(resolved.key);
      if (!meta) return new NextResponse(null, { status: 404 });
      return new NextResponse(null, { status: 200, headers: baseHeaders(resolved.contentType, meta.size) });
    }
    const fileBuffer = await store.get(resolved.key);
    if (!fileBuffer) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, { status: 200, headers: baseHeaders(resolved.contentType, fileBuffer.length) });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolved = await resolvePublicUpload(params);
    if (!resolved) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const store = getBlobStore();
    const rangeHeader = request.headers.get('range');
    const requestedRange = parseByteRange(rangeHeader);

    if (store.getStream) {
      if (rangeHeader && !requestedRange) {
        return new NextResponse(null, { status: 416 });
      }
      const streamed = await store.getStream(resolved.key, requestedRange ?? undefined);
      if (!streamed) {
        if (requestedRange && store.head) {
          const meta = await store.head(resolved.key);
          if (meta) {
            return new NextResponse(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${meta.size}` },
            });
          }
        }
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (streamed.range) {
        const length = streamed.range.end - streamed.range.start + 1;
        return new NextResponse(streamed.body, {
          status: 206,
          headers: {
            ...baseHeaders(resolved.contentType, length),
            'Content-Range': `bytes ${streamed.range.start}-${streamed.range.end}/${streamed.size}`,
          },
        });
      }
      return new NextResponse(streamed.body, {
        status: 200,
        headers: baseHeaders(resolved.contentType, streamed.size),
      });
    }

    const fileBuffer = await store.get(resolved.key);
    if (!fileBuffer) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new NextResponse(fileBuffer as BodyInit, {
      status: 200,
      headers: baseHeaders(resolved.contentType, fileBuffer.length),
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
