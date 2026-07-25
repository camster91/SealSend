import { NextRequest, NextResponse } from 'next/server';
import { requireApiHost } from '@/lib/auth/api-auth';
import { query, queryOne } from '@/lib/db/client';
import { rsvpFieldSchema } from '@/lib/validations';

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

    // Verify ownership
    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const fields = await query(
      'SELECT * FROM rsvp_fields WHERE event_id = $1 ORDER BY sort_order ASC',
      [eventId]
    );

    return NextResponse.json(fields);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    // Verify ownership
    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be an array of RSVP field objects' },
        { status: 400 }
      );
    }

    // Validate ALL fields BEFORE deleting existing ones (atomic approach)
    const fields = [];
    for (let index = 0; index < body.length; index++) {
      const parsed = rsvpFieldSchema.safeParse(body[index]);
      if (!parsed.success) {
        return NextResponse.json(
          { error: `Invalid field at index ${index}`, details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      fields.push({
        event_id: eventId,
        field_name: parsed.data.field_name,
        field_type: parsed.data.field_type,
        field_label: parsed.data.field_label,
        is_required: parsed.data.is_required,
        is_enabled: parsed.data.is_enabled,
        sort_order: index,
        options: parsed.data.options ?? null,
        placeholder: parsed.data.placeholder ?? null,
      });
    }

    // Delete existing RSVP fields for this event (only after validation passes)
    await query('DELETE FROM rsvp_fields WHERE event_id = $1', [eventId]);

    // Insert validated fields
    if (fields.length > 0) {
      const valueClauses: string[] = [];
      const allParams: unknown[] = [];
      let paramIndex = 1;

      for (const f of fields) {
        valueClauses.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`
        );
        allParams.push(
          f.event_id, f.field_name, f.field_type, f.field_label,
          f.is_required, f.is_enabled, f.sort_order, f.options, f.placeholder
        );
        paramIndex += 9;
      }

      await query(
        `INSERT INTO rsvp_fields (event_id, field_name, field_type, field_label, is_required, is_enabled, sort_order, options, placeholder)
         VALUES ${valueClauses.join(', ')}`,
        allParams
      );
    }

    // Return the newly inserted fields
    const updatedFields = await query(
      'SELECT * FROM rsvp_fields WHERE event_id = $1 ORDER BY sort_order ASC',
      [eventId]
    );

    return NextResponse.json(updatedFields);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
