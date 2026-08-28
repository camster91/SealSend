import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/client';
import { requireApiHost } from '@/lib/auth/api-auth';
import { eventCreateSchema } from '@/lib/validations';
import { generateSlug } from '@/lib/utils';
import { DEFAULT_RSVP_FIELDS } from '@/lib/constants';
import { canCreateEvent } from '@/lib/entitlements';
import { getUserTier } from '@/lib/subscription';
import { recordActivationEventSafely } from '@/lib/analytics/activation-events';
import { getPublicationReadiness } from '@/lib/publication-readiness';

export async function GET() {
  try {
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

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
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    const [accountPlan, eventCount] = await Promise.all([
      getUserTier(user.id),
      queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM events WHERE user_id = $1 AND status <> 'archived'",
        [user.id],
      ),
    ]);
    if (!canCreateEvent(accountPlan, Number(eventCount?.count ?? 0))) {
      return NextResponse.json(
        { error: 'This plan supports one active event. Archive the current event before creating another.' },
        { status: 403 }
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

    if (parsed.data.status === 'published') {
      const readiness = getPublicationReadiness(parsed.data);
      if (!readiness.ready) {
        return NextResponse.json(
          { error: 'Event is not ready to publish', blockers: readiness.blockers },
          { status: 400 },
        );
      }
    }

    const { title, description, invitation_headline, invitation_body, reminder_sequence, ai_generation_id, ai_edit_count, event_date, event_end_date, event_timezone, location_name, location_address, host_name, dress_code, rsvp_deadline, registry_links, max_attendees, allow_plus_ones, max_guests_per_rsvp, design_url, design_type, customization, status } = parsed.data;
    if (ai_generation_id) {
      const generation = await queryOne("SELECT id FROM ai_generations WHERE id = $1 AND user_id = $2 AND outcome = 'accepted'", [ai_generation_id, user.id]);
      if (!generation) return NextResponse.json({ error: 'AI generation was not accepted by this host' }, { status: 400 });
    }

    // Retry slug generation on collision (unique constraint)
    let event = null;
    let insertError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = generateSlug(title);
      try {
        event = await queryOne(
          `INSERT INTO events (
            user_id, title, slug, description, invitation_headline, invitation_body, reminder_sequence, ai_generation_id, event_date, event_end_date, event_timezone,
            location_name, location_address, host_name, dress_code,
            rsvp_deadline, registry_links, max_attendees, allow_plus_ones,
            max_guests_per_rsvp, design_url, design_type, customization, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
          ) RETURNING *`,
          [
            user.id,
            title,
            slug,
            description ?? null,
            invitation_headline ?? null,
            invitation_body ?? null,
            JSON.stringify(reminder_sequence ?? []),
            ai_generation_id ?? null,
            event_date ?? null,
            event_end_date ?? null,
            event_timezone,
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
      console.error('Event insert failed:', insertError.message);
      return NextResponse.json(
        { error: 'Failed to create event' },
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
          field.options ? JSON.stringify(field.options) : null,
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

    if (event) {
      if (ai_generation_id && ai_edit_count !== undefined) {
        await query('UPDATE ai_generations SET edit_count = $3 WHERE id = $1 AND user_id = $2', [ai_generation_id, user.id, ai_edit_count]);
      }
      await recordActivationEventSafely({
        name: 'event_draft_started',
        userId: user.id,
        eventId: (event as { id: string }).id,
        metadata: { source: ai_generation_id ? 'ai_assisted' : 'manual', plan: accountPlan },
      });
    }

    return NextResponse.json(event, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
