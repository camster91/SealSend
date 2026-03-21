import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/client';
import { getApiUser } from '@/lib/auth/api-auth';
import { eventCreateSchema } from '@/lib/validations';
import { generateSlug } from '@/lib/utils';
import { DEFAULT_RSVP_FIELDS } from '@/lib/constants';

export async function GET() {
  try {
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const events = await query(
      'SELECT * FROM events WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    );

    return NextResponse.json(events);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = eventCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, event_date, event_end_date, location_name, location_address, host_name, dress_code, rsvp_deadline, registry_links, max_attendees, allow_plus_ones, max_guests_per_rsvp, design_url, design_type, customization, status } = parsed.data;

    // Retry slug generation on collision (unique constraint)
    let event = null;
    let insertError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = generateSlug(title);
      try {
        event = await queryOne(
          `INSERT INTO events (
            user_id, title, slug, description, event_date, event_end_date,
            location_name, location_address, host_name, dress_code,
            rsvp_deadline, registry_links, max_attendees, allow_plus_ones,
            max_guests_per_rsvp, design_url, design_type, customization, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
          ) RETURNING *`,
          [
            user.id,
            title,
            slug,
            description ?? null,
            event_date ?? null,
            event_end_date ?? null,
            location_name ?? null,
            location_address ?? null,
            host_name ?? null,
            dress_code ?? null,
            rsvp_deadline ?? null,
            JSON.stringify(registry_links ?? []),
            max_attendees ?? null,
            allow_plus_ones ?? null,
            max_guests_per_rsvp ?? null,
            design_url ?? null,
            design_type ?? 'upload',
            JSON.stringify(customization ?? {}),
            status ?? 'draft',
          ]
        );
        insertError = null;
        break;
      } catch (err: unknown) {
        const pgError = err as { code?: string; message?: string };
        // If not a unique constraint violation, don't retry
        if (pgError.code !== '23505') {
          insertError = pgError;
          break;
        }
        insertError = pgError;
      }
    }

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Insert default RSVP fields for the new event
    if (event && DEFAULT_RSVP_FIELDS.length > 0) {
      const placeholders: string[] = [];
      const values: unknown[] = [];
      let paramIdx = 1;

      DEFAULT_RSVP_FIELDS.forEach((field, index) => {
        placeholders.push(
          `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8})`
        );
        values.push(
          (event as Record<string, unknown>).id,
          field.field_name,
          field.field_type,
          field.field_label,
          field.is_required,
          field.is_enabled,
          index,
          field.options ?? null,
          field.placeholder ?? null,
        );
        paramIdx += 9;
      });

      try {
        await query(
          `INSERT INTO rsvp_fields (event_id, field_name, field_type, field_label, is_required, is_enabled, sort_order, options, placeholder) VALUES ${placeholders.join(', ')}`,
          values
        );
      } catch (rsvpErr: unknown) {
        const rsvpError = rsvpErr as { message?: string };
        console.error('Failed to insert default RSVP fields:', rsvpError.message);
      }
    }

    return NextResponse.json(event, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
