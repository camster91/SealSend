import { NextRequest, NextResponse } from 'next/server';
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { queryOne } from '@/lib/db/client';
import { recordActivationEventSafely } from '@/lib/analytics/activation-events';
import { getPublicationReadiness, type PublicationCandidate } from '@/lib/publication-readiness';
import { enqueueWebhookEvent } from "@/lib/webhooks";

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
    const event = await queryOne<PublicationCandidate & { id: string; status: string }>(
      `SELECT id, status, title, event_date, event_end_date, location_name, max_attendees,
              invitation_headline, invitation_body, rsvp_deadline, event_brief
         FROM events WHERE id = $1`,
      [eventId]
    );

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (event.status === 'archived') {
      return NextResponse.json(
        { error: 'Archived events cannot be published directly. Use Repeat event to create a reviewed new draft.' },
        { status: 409 },
      );
    }

    // Toggle status between draft and published
    const newStatus = event.status === 'published' ? 'draft' : 'published';
    if (newStatus === 'published') {
      const readiness = getPublicationReadiness(event);
      if (!readiness.ready) {
        return NextResponse.json(
          { error: 'Event is not ready to publish', blockers: readiness.blockers },
          { status: 400 },
        );
      }
    }

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
      await enqueueWebhookEvent(eventId, 'event.published', {});
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
