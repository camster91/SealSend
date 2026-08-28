import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/client';
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { eventUpdateSchema } from '@/lib/validations';
import { getPublicationReadiness, type PublicationCandidate } from '@/lib/publication-readiness';

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const auth = await requireEventPermission(eventId, 'view_event');
    if (auth.error) return auth.error;

    const event = await queryOne(
      'SELECT * FROM events WHERE id = $1',
      [eventId]
    );

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const auth = await requireEventPermission(eventId, 'edit_event');
    if (auth.error) return auth.error;

    // Verify ownership
    const existing = await queryOne<PublicationCandidate & { id: string; status: string }>(
      `SELECT id, status, title, event_date, event_end_date, location_name, max_attendees,
              invitation_headline, invitation_body, rsvp_deadline, event_brief
         FROM events WHERE id = $1`,
      [eventId]
    );

    if (!existing) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = eventUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const targetStatus = parsed.data.status ?? existing.status;
    if (existing.status === 'archived' && targetStatus !== 'archived') {
      return NextResponse.json(
        { error: 'Archived events cannot be reactivated directly. Use Repeat event to create a reviewed new draft.' },
        { status: 409 },
      );
    }
    if (targetStatus === 'published') {
      const readiness = getPublicationReadiness({ ...existing, ...parsed.data });
      if (!readiness.ready) {
        return NextResponse.json(
          { error: 'Event is not ready to publish', blockers: readiness.blockers },
          { status: 400 },
        );
      }
    }
    if (parsed.data.ai_generation_id) {
      const generation = await queryOne(
        "SELECT id FROM ai_generations WHERE id = $1 AND user_id = $2 AND outcome = 'accepted'",
        [parsed.data.ai_generation_id, auth.user.id]
      );
      if (!generation) return NextResponse.json({ error: 'AI generation was not accepted by this host' }, { status: 400 });
    }

    const ALLOWED_COLUMNS = [
      'title', 'description', 'invitation_headline', 'invitation_body', 'reminder_sequence', 'event_brief', 'ai_generation_id', 'event_date', 'event_end_date', 'event_timezone',
      'location_name', 'location_address', 'host_name', 'dress_code',
      'rsvp_deadline', 'registry_links', 'max_attendees', 'allow_plus_ones',
      'max_guests_per_rsvp', 'design_url', 'design_type', 'customization',
      'status', 'auto_reminders',
    ];

    const updates = parsed.data as Record<string, unknown>;
    const keys = Object.keys(updates).filter((key) => ALLOWED_COLUMNS.includes(key));

    if (keys.length === 0) {
      return NextResponse.json(existing);
    }

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = keys.map((key) => {
      const val = updates[key];
      // JSON columns need to be stringified
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        return JSON.stringify(val);
      }
      if (Array.isArray(val)) {
        return JSON.stringify(val);
      }
      return val;
    });

    const event = await queryOne(
      `UPDATE events SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, eventId]
    );

    if (!event) {
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      );
    }

    return NextResponse.json(event);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const auth = await requireEventPermission(eventId, 'delete_event');
    if (auth.error) return auth.error;

    // Verify ownership
    const existing = await queryOne(
      'SELECT id FROM events WHERE id = $1',
      [eventId]
    );

    if (!existing) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    await query(
      'DELETE FROM events WHERE id = $1',
      [eventId]
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
