import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/client';
import { requireApiHost } from '@/lib/auth/api-auth';
import { eventUpdateSchema } from '@/lib/validations';

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    const event = await queryOne(
      'SELECT * FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
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
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Verify ownership
    const existing = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
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

    const ALLOWED_COLUMNS = [
      'title', 'description', 'event_date', 'event_end_date', 'event_timezone',
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
      `UPDATE events SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2} RETURNING *`,
      [...values, eventId, user.id]
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
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Verify ownership
    const existing = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!existing) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    await query(
      'DELETE FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
