import { NextRequest, NextResponse } from 'next/server';
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { queryOne } from '@/lib/db/client';
import { recordActivationEventSafely } from '@/lib/analytics/activation-events';

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const auth = await requireEventPermission(eventId, 'edit_event');
    if (auth.error) return auth.error;
    const user = auth.user;

    // Fetch the current event to get its status
    const event = await queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM events WHERE id = $1',
      [eventId]
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
      'UPDATE events SET status = $1 WHERE id = $2 RETURNING *',
      [newStatus, eventId]
    );

    if (!updatedEvent) {
      return NextResponse.json(
        { error: 'Failed to update event status' },
        { status: 500 }
      );
    }

    if (newStatus === 'published') {
      await recordActivationEventSafely({
        name: 'event_published',
        userId: user.id,
        eventId,
        metadata: { source: 'dashboard' },
      });
    }

    return NextResponse.json(updatedEvent);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
