import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { deleteRsvp, type RsvpQuery } from '../src/lib/rsvp-store';
import { rsvpResponseValues, serializeRsvpResponseValue, validateRsvpResponseData } from '../src/lib/rsvp-fields';
import type { RSVPField } from '../src/types/database';

const eventId = '00000000-0000-4000-8000-000000000071';
const guestId = '00000000-0000-4000-8000-000000000072';
const olderResponseId = '00000000-0000-4000-8000-000000000073';
const newerResponseId = '00000000-0000-4000-8000-000000000074';

function field(overrides: Partial<RSVPField>): RSVPField {
  return {
    id: '00000000-0000-4000-8000-000000000075',
    event_id: eventId,
    field_name: 'custom_answer',
    field_label: 'Custom answer',
    field_type: 'text',
    options: null,
    placeholder: null,
    is_required: false,
    is_enabled: true,
    sort_order: 0,
    created_at: '',
    ...overrides,
  };
}

test('deleting a response recalculates the invited guest status and falls back to pending', async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE events (id UUID PRIMARY KEY);
    CREATE TABLE guests (id UUID PRIMARY KEY, event_id UUID, rsvp_status TEXT, updated_at TIMESTAMPTZ);
    CREATE TABLE rsvp_responses (
      id UUID PRIMARY KEY, event_id UUID, guest_id UUID, status TEXT,
      submitted_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
    );
    INSERT INTO events (id) VALUES ('${eventId}');
    INSERT INTO guests (id, event_id, rsvp_status) VALUES ('${guestId}', '${eventId}', 'attending');
    INSERT INTO rsvp_responses (id, event_id, guest_id, status, submitted_at, updated_at)
      VALUES ('${olderResponseId}', '${eventId}', '${guestId}', 'not_attending', NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes');
    INSERT INTO rsvp_responses (id, event_id, guest_id, status, submitted_at, updated_at)
      VALUES ('${newerResponseId}', '${eventId}', '${guestId}', 'attending', NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute');
  `);
  const execute: RsvpQuery = async <T>(sql: string, values?: unknown[]) => ({ rows: (await db.query<T>(sql, values)).rows });
  try {
    await db.transaction((tx) => deleteRsvp(async <T>(sql: string, values?: unknown[]) => ({ rows: (await tx.query<T>(sql, values)).rows }), eventId, newerResponseId));
    assert.equal((await db.query<{ rsvp_status: string }>('SELECT rsvp_status FROM guests WHERE id = $1', [guestId])).rows[0].rsvp_status, 'not_attending');
    assert.equal((await db.query('SELECT id FROM rsvp_responses WHERE id = $1', [newerResponseId])).rows.length, 0);

    assert.equal(await deleteRsvp(execute, eventId, olderResponseId), true);
    assert.equal((await db.query<{ rsvp_status: string }>('SELECT rsvp_status FROM guests WHERE id = $1', [guestId])).rows[0].rsvp_status, 'pending');
    assert.equal(await deleteRsvp(execute, eventId, olderResponseId), false);
  } finally {
    await db.close();
  }
});

test('custom RSVP textarea and multiselect answers require the configured shape and choices', () => {
  const fields = [
    field({ field_name: 'meal_preferences', field_label: 'Meal preferences', field_type: 'multiselect', options: ['Vegetarian', 'Vegan'], is_required: true }),
    field({ id: '00000000-0000-4000-8000-000000000076', field_name: 'notes', field_label: 'Notes', field_type: 'textarea', is_required: true }),
    field({ id: '00000000-0000-4000-8000-000000000077', field_name: 'name', field_label: 'Name', field_type: 'text', is_required: true }),
    field({ id: '00000000-0000-4000-8000-000000000078', field_name: 'meal_type', field_label: 'Meal type', field_type: 'select', options: ['Dinner'], is_required: false }),
  ];

  assert.deepEqual(validateRsvpResponseData(fields, { meal_preferences: ['Vegan'], notes: 'Please seat me near the aisle' }), { valid: true });
  assert.deepEqual(validateRsvpResponseData(fields, { meal_preferences: 'Vegan', notes: 'legacy scalar' }), { valid: true });
  assert.deepEqual(validateRsvpResponseData(fields, { meal_preferences: ['Vegetarian'], notes: 'old choice retained' }, { meal_preferences: ['Vegetarian'] }), { valid: true });
  assert.equal(validateRsvpResponseData(fields, { meal_preferences: ['Retired choice'], notes: 'fabricated new choice' }, { meal_preferences: ['Vegetarian'] }).valid, false);
  assert.equal(validateRsvpResponseData(fields, { meal_preferences: ['Vegan'], notes: 'ok', meal_type: 'Lunch' }, { meal_preferences: ['Vegan'], meal_type: 'Lunch' }).valid, true);
  assert.equal(validateRsvpResponseData(fields, { meal_preferences: ['Vegan'], notes: 'ok', meal_type: 'Breakfast' }, { meal_preferences: ['Vegan'], meal_type: 'Lunch' }).valid, false);
  assert.equal(validateRsvpResponseData(fields, { meal_preferences: ['Vegan'], notes: 'ok', name: 12 }).valid, true);
  assert.equal(validateRsvpResponseData(fields, { meal_preferences: ['Gluten-free'], notes: 'ok' }).valid, false);
  assert.equal(validateRsvpResponseData(fields, { meal_preferences: ['Vegan'], notes: '' }).valid, false);
  // The legacy reserved name field is represented by the top-level payload and
  // therefore does not make an otherwise valid historical answer invalid.
  assert.deepEqual(validateRsvpResponseData(fields, { meal_preferences: ['Vegetarian'], notes: 'ok', name: ['legacy'] }), { valid: true });
  assert.deepEqual(rsvpResponseValues('Legacy choice'), ['Legacy choice']);
  assert.deepEqual(rsvpResponseValues(['Vegetarian', 'Vegan']), ['Vegetarian', 'Vegan']);
  assert.equal(serializeRsvpResponseValue(['Vegetarian', 'Vegan']), 'Vegetarian; Vegan');
});
