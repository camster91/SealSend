import { NextRequest, NextResponse } from 'next/server';
import { batch, query, queryOne } from '@/lib/db/client';
import { abortCode, guard, type Statement } from '@/lib/db/sqlite-dialect';
import { requireApiHost } from '@/lib/auth/api-auth';
import { eventCreateSchema } from '@/lib/validations';
import { generateSlug } from '@/lib/utils';
import { DEFAULT_RSVP_FIELDS } from '@/lib/constants';
import { canCreateEvent } from '@/lib/entitlements';
import { getUserTier } from '@/lib/subscription';
import { recordActivationEventSafely } from '@/lib/analytics/activation-events';
import { getPublicationReadiness } from '@/lib/publication-readiness';
import { withDefaultInvitationCopy } from '@/lib/invitation-defaults';
import { getMobileContext } from '@/lib/auth/mobile-context';
import { toTimestamp } from '@/lib/events';
import { createHash } from 'node:crypto';

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

    const body = await request.json();
    const mutationKey = getMobileContext() ? request.headers.get('Idempotency-Key') : null;
    if (getMobileContext() && (!mutationKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mutationKey))) {
      return NextResponse.json({ error: 'A valid draft mutation key is required.' }, { status: 400 });
    }
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

    const publishCopy = parsed.data.status === 'published' ? withDefaultInvitationCopy(parsed.data) : parsed.data;
    const { title, description, reminder_sequence, event_brief, ai_generation_id, ai_edit_count, event_date, event_end_date, event_timezone, location_name, location_address, host_name, dress_code, rsvp_deadline, registry_links, max_attendees, allow_plus_ones, max_guests_per_rsvp, design_url, design_type, customization, status } = parsed.data;
    const { invitation_headline, invitation_body } = publishCopy;
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
    const requestHash = createHash('sha256').update(JSON.stringify({ ...parsed.data, organization_id: organizationId })).digest('hex');

    // D1 has no interactive transactions: read and validate first, then write everything in one
    // batch whose guards re-check what a concurrent request could change (the mutation key and the
    // active event count). A lost race or a slug collision retries from the reads.
    let event: Record<string, unknown> | null = null;
    let insertError: { message?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (mutationKey) {
        const previous = await queryOne<{ request_hash: string; event_id: string | null }>(
          'SELECT request_hash, event_id FROM mobile_event_mutations WHERE user_id = $1 AND mutation_key = $2', [user.id, mutationKey],
        );
        if (previous) {
          if (previous.request_hash !== requestHash) {
            return NextResponse.json({ error: 'This draft key was already used for different details. Recover the original draft.' }, { status: 409 });
          }
          const recovered = await queryOne('SELECT * FROM events WHERE id = $1 AND user_id = $2', [previous.event_id, user.id]);
          return recovered ? NextResponse.json(recovered) : NextResponse.json({ error: 'The previously saved event was deleted.' }, { status: 410 });
        }
      }

      const eventCountResult = await queryOne<{ count: number }>(
        "SELECT COUNT(*) AS count FROM events WHERE user_id = $1 AND status <> 'archived'",
        [user.id],
      );
      const eventCount = Number(eventCountResult?.count ?? 0);
      if (!canCreateEvent(accountPlan, eventCount)) {
        return NextResponse.json(
          { error: 'This plan supports one active event. Archive the current event before creating another.' },
          { status: 403 }
        );
      }

      if (ai_generation_id) {
        const generation = await queryOne(
          "SELECT id FROM ai_generations WHERE id = $1 AND user_id = $2 AND outcome = 'accepted'",
          [ai_generation_id, user.id],
        );
        if (!generation) {
          return NextResponse.json({ error: 'AI generation was not accepted by this host' }, { status: 400 });
        }
      }

      const eventId = crypto.randomUUID();
      const slug = generateSlug(title);
      const statements: Statement[] = [];
      if (mutationKey) {
        statements.push(guard(
          'NOT EXISTS (SELECT 1 FROM mobile_event_mutations WHERE user_id = $1 AND mutation_key = $2)',
          [user.id, mutationKey],
          'mutation_exists',
        ));
      }
      // No other event was created since the count above was checked against the plan.
      statements.push(guard(
        "(SELECT COUNT(*) FROM events WHERE user_id = $1 AND status <> 'archived') <= $2",
        [user.id, eventCount],
        'event_count_changed',
      ));
      statements.push({
        text: `INSERT INTO events (
            id, user_id, title, slug, description, invitation_headline, invitation_body, reminder_sequence, event_brief, ai_generation_id, event_date, event_end_date, event_timezone,
            location_name, location_address, host_name, dress_code,
            rsvp_deadline, registry_links, max_attendees, allow_plus_ones,
            max_guests_per_rsvp, design_url, design_type, customization, status, organization_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
          )`,
        params: [
          eventId,
          user.id,
          title,
          slug,
          description ?? null,
          invitation_headline ?? null,
          invitation_body ?? null,
          JSON.stringify(reminder_sequence ?? []),
          event_brief ? JSON.stringify(event_brief) : null,
          ai_generation_id ?? null,
          toTimestamp(event_date),
          toTimestamp(event_end_date),
          event_timezone,
          location_name ?? null,
          location_address ?? null,
          host_name ?? null,
          dress_code ?? null,
          toTimestamp(rsvp_deadline),
          JSON.stringify(registry_links ?? []),
          max_attendees ?? null,
          allow_plus_ones ?? null,
          max_guests_per_rsvp ?? null,
          design_url ?? null,
          design_type ?? 'upload',
          JSON.stringify(customization ?? {}),
          status ?? 'draft',
          organizationId,
        ],
      });

      // Insert default RSVP fields for the new event
      if (DEFAULT_RSVP_FIELDS.length > 0) {
        const placeholders: string[] = [];
        const values: unknown[] = [];
        let paramIdx = 1;

        DEFAULT_RSVP_FIELDS.forEach((field, index) => {
          placeholders.push(
            `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8})`
          );
          values.push(
            eventId,
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

        statements.push({
          text: `INSERT INTO rsvp_fields (event_id, field_name, field_type, field_label, is_required, is_enabled, sort_order, options, placeholder) VALUES ${placeholders.join(', ')}`,
          params: values,
        });
      }

      if (mutationKey) {
        statements.push({
          text: 'INSERT INTO mobile_event_mutations(user_id, mutation_key, request_hash, event_id) VALUES ($1,$2,$3,$4)',
          params: [user.id, mutationKey, requestHash, eventId],
        });
      }
      if (ai_generation_id && ai_edit_count !== undefined) {
        statements.push({
          text: 'UPDATE ai_generations SET edit_count = $3 WHERE id = $1 AND user_id = $2',
          params: [ai_generation_id, user.id, ai_edit_count],
        });
      }
      // Read the row back last: the default-workspace trigger sets organization_id after the insert.
      statements.push({ text: 'SELECT * FROM events WHERE id = $1', params: [eventId] });

      try {
        const results = await batch<Record<string, unknown>>(statements);
        event = results[results.length - 1][0] ?? null;
        insertError = null;
        break;
      } catch (err: unknown) {
        // A concurrent request won the race: the next attempt's reads see its result.
        const code = abortCode(err);
        if (code === 'mutation_exists' || code === 'event_count_changed') continue;
        const message = err instanceof Error ? err.message : String(err);
        if (!/UNIQUE constraint failed: events\.slug/.test(message)) {
          throw err;
        }
        insertError = { message };
      }
    }

    if (insertError || !event) {
      console.error('Event insert failed:', insertError?.message ?? 'concurrent create retries exhausted');
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    await recordActivationEventSafely({
      name: 'event_draft_started',
      userId: user.id,
      eventId: event.id as string,
      metadata: { source: ai_generation_id ? 'ai_assisted' : 'manual', plan: accountPlan },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Event creation failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
