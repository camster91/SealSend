import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/client';
import { requireEventPermission } from '@/lib/auth/event-api-access';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await requireEventPermission(eventId, 'view_event');
    if (auth.error) return auth.error;

    const event = await queryOne<{ slug: string }>(
      'SELECT slug FROM events WHERE id = $1',
      [eventId]
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
