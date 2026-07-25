import { NextRequest, NextResponse } from 'next/server';
import { requireApiHost } from '@/lib/auth/api-auth';
import { queryOne } from '@/lib/db/client';

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Fetch the current event to get its status
    const event = await queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Toggle status between draft and published
    const newStatus = event.status === 'published' ? 'draft' : 'published';

    const updatedEvent = await queryOne(
      'UPDATE events SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [newStatus, eventId, user.id]
    );

    if (!updatedEvent) {
      return NextResponse.json(
        { error: 'Failed to update event status' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedEvent);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
