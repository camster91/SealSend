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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;

    if (!segments || segments.length === 0 || segments.includes('social-private')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const key = blobKeySegments(segments.join('/'))?.join('/');
    if (!key) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const ext = path.extname(key).toLowerCase();

    // Never serve SVG as active content
    if (ext === '.svg' || ext === '.svgz' || ext === '.html' || ext === '.htm' || ext === '.js') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const fileBuffer = await getBlobStore().get(key);
    if (!fileBuffer) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
