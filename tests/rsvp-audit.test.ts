import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from '../src/lib/db/sqlite-local';
import { deleteRsvp, saveRsvp } from '../src/lib/rsvp-store';
import { rsvpSubmissionSchema } from '../src/lib/validations';
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

async function auditFixture() {
  const db = openTestDb();
  await db.query("INSERT INTO events (id, user_id, title, slug, status) VALUES ($1, 'host', 'Event', 'audit', 'published')", [eventId]);
  await db.query("INSERT INTO guests (id, event_id, name, rsvp_status) VALUES ($1, $2, 'Guest', 'attending')", [guestId, eventId]);
  const older = new Date(Date.now() - 120_000);
  const newer = new Date(Date.now() - 60_000);
  await db.query(
    "INSERT INTO rsvp_responses (id, event_id, guest_id, respondent_name, status, submitted_at, updated_at) VALUES ($1, $2, $3, 'Guest', 'not_attending', $4, $4), ($5, $2, $3, 'Guest', 'attending', $6, $6)",
    [olderResponseId, eventId, guestId, older, newerResponseId, newer],
  );
  return db;
}

test('deleting a response recalculates the invited guest status and falls back to pending', async () => {
  const db = await auditFixture();
  try {
    assert.equal(await deleteRsvp(db, eventId, newerResponseId), true);
    assert.equal((await db.query<{ rsvp_status: string }>('SELECT rsvp_status FROM guests WHERE id = $1', [guestId]))[0].rsvp_status, 'not_attending');
    assert.equal((await db.query('SELECT id FROM rsvp_responses WHERE id = $1', [newerResponseId])).length, 0);

    assert.equal(await deleteRsvp(db, eventId, olderResponseId), true);
    assert.equal((await db.query<{ rsvp_status: string }>('SELECT rsvp_status FROM guests WHERE id = $1', [guestId]))[0].rsvp_status, 'pending');
    assert.equal(await deleteRsvp(db, eventId, olderResponseId), false);
  } finally {
    db.handle.close();
  }
});

test('a delete racing a public reply leaves the guest status matching the remaining response', async () => {
  const db = await auditFixture();
  try {
    const reply = rsvpSubmissionSchema.parse({ respondent_name: 'Guest', status: 'maybe', headcount: 1, plus_ones: [] });
    const [, deleted] = await Promise.all([saveRsvp(db, eventId, guestId, undefined, reply, null), deleteRsvp(db, eventId, olderResponseId)]);
    assert.equal(deleted, true);
    const latest = (await db.query<{ status: string }>('SELECT status FROM rsvp_responses WHERE guest_id = $1 ORDER BY updated_at DESC, submitted_at DESC, id DESC LIMIT 1', [guestId]))[0];
    const guest = (await db.query<{ rsvp_status: string }>('SELECT rsvp_status FROM guests WHERE id = $1', [guestId]))[0];
    assert.equal(guest.rsvp_status, latest?.status ?? 'pending');
  } finally {
    db.handle.close();
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
