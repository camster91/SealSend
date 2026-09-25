import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { getDb, query, queryOne } from '@/lib/db/client';
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
  let client: PoolClient | null = null;
  try {
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

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

    const { title, description, invitation_headline, invitation_body, reminder_sequence, event_brief, ai_generation_id, ai_edit_count, event_date, event_end_date, event_timezone, location_name, location_address, host_name, dress_code, rsvp_deadline, registry_links, max_attendees, allow_plus_ones, max_guests_per_rsvp, design_url, design_type, customization, status } = parsed.data;
    // Optional team workspace; the database defaults to the host's personal workspace.
    const requestedOrganization = typeof body?.organization_id === 'string' ? body.organization_id : null;
    let organizationId: string | null = null;
    if (requestedOrganization) {
      const membership = /^[0-9a-f-]{36}$/i.test(requestedOrganization) ? await queryOne<{ role: string }>(
        `SELECT m.role FROM organization_members m JOIN organizations o ON o.id = m.organization_id
          WHERE m.organization_id = $1 AND m.user_id = $2 AND NOT o.is_personal`,
        [requestedOrganization, user.id],
      ) : null;
      if (!membership || !['owner', 'admin', 'planner'].includes(membership.role)) {
        return NextResponse.json({ error: 'You cannot create events in this workspace.' }, { status: 403 });
      }
      organizationId = requestedOrganization;
    }

    const accountPlan = await getUserTier(user.id);
    client = await getDb().connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id]);

    const eventCountResult = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM events WHERE user_id = $1 AND status <> 'archived'",
      [user.id],
    );
    if (!canCreateEvent(accountPlan, Number(eventCountResult.rows[0]?.count ?? 0))) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'This plan supports one active event. Archive the current event before creating another.' },
        { status: 403 }
      );
    }

    if (ai_generation_id) {
      const generation = await client.query(
        "SELECT id FROM ai_generations WHERE id = $1 AND user_id = $2 AND outcome = 'accepted'",
        [ai_generation_id, user.id],
      );
      if (!generation.rows[0]) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'AI generation was not accepted by this host' }, { status: 400 });
      }
    }

    // Retry slug generation on collision (unique constraint)
    let event = null;
    let insertError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = generateSlug(title);
      await client.query('SAVEPOINT event_slug_attempt');
      try {
        const inserted = await client.query(
          `INSERT INTO events (
            user_id, title, slug, description, invitation_headline, invitation_body, reminder_sequence, event_brief, ai_generation_id, event_date, event_end_date, event_timezone,
            location_name, location_address, host_name, dress_code,
            rsvp_deadline, registry_links, max_attendees, allow_plus_ones,
            max_guests_per_rsvp, design_url, design_type, customization, status, organization_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
          ) RETURNING *`,
          [
            user.id,
            title,
            slug,
            description ?? null,
            invitation_headline ?? null,
            invitation_body ?? null,
            JSON.stringify(reminder_sequence ?? []),
            event_brief ? JSON.stringify(event_brief) : null,
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
            organizationId,
          ]
        );
        event = inserted.rows[0] ?? null;
        await client.query('RELEASE SAVEPOINT event_slug_attempt');
        insertError = null;
        break;
      } catch (err: unknown) {
        const pgError = err as { code?: string; message?: string };
        await client.query('ROLLBACK TO SAVEPOINT event_slug_attempt');
        if (pgError.code !== '23505') {
          throw err;
        }
        insertError = pgError;
      }
    }

    if (insertError) {
      console.error('Event insert failed:', insertError.message);
      await client.query('ROLLBACK');
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

      await client.query(
        `INSERT INTO rsvp_fields (event_id, field_name, field_type, field_label, is_required, is_enabled, sort_order, options, placeholder) VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    if (event) {
      if (ai_generation_id && ai_edit_count !== undefined) {
        await client.query('UPDATE ai_generations SET edit_count = $3 WHERE id = $1 AND user_id = $2', [ai_generation_id, user.id, ai_edit_count]);
      }
      await client.query('COMMIT');
      await recordActivationEventSafely({
        name: 'event_draft_started',
        userId: user.id,
        eventId: (event as { id: string }).id,
        metadata: { source: ai_generation_id ? 'ai_assisted' : 'manual', plan: accountPlan },
      });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The connection may already be outside a transaction.
      }
    }
    console.error('Event creation failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
