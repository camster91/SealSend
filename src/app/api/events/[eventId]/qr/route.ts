import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/client';
import { requireApiHost } from '@/lib/auth/api-auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    const { eventId } = await params;

    const event = await queryOne<{ slug: string }>(
      'SELECT slug FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sealsend.app';
    const url = `${siteUrl}/e/${event.slug}`;

    const QRCode = require('qrcode');
    const buffer = await QRCode.toBuffer(url, { type: 'png', width: 400 });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
