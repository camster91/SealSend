import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrivalCounts, backFrom, nextHour, replyTotals, rsvpLabel, sortForDoor, walkInFor, type Attendee } from '../src/model';
const guest = (name: string, rsvp_status: string, headcount = 1, checked_in_at: string | null = null): Attendee => ({ id: name, name, rsvp_status, headcount, checked_in_at, source: 'guest' });
const list = [guest('Ana', 'attending', 2, '2026-01-01'), guest('Ben', 'attending', 3), guest('Cy', 'not_attending'), guest('Di', 'pending'), guest('Ed', 'maybe')];
test('arrivals count people and leave out those who declined', () => assert.deepEqual(arrivalCounts(list), { here: 2, toCome: 3 }));
test('people still to come are listed first', () => assert.deepEqual(sortForDoor(list).map(g => g.name), ['Ben', 'Di', 'Ed', 'Cy', 'Ana']));
test('reply totals count people who said yes and replies otherwise', () => assert.deepEqual(replyTotals(list), { yes: 5, no: 1, maybe: 1, waiting: 1 }));
test('replies read as plain words', () => {
  assert.equal(rsvpLabel(guest('A', 'attending', 2)), 'Said yes · 2 people');
  assert.equal(rsvpLabel(guest('A', 'not_attending')), 'Said no');
  assert.equal(rsvpLabel(guest('A', 'pending')), 'No reply yet');
});
test('a new event starts on the hour', () => assert.equal(nextHour(new Date('2026-12-01T11:25:28.400Z')).toISOString(), '2026-12-01T12:00:00.000Z'));
test('a retried walk-in keeps its id, a different person gets a new one', () => {
  let n = 0; const make = () => `id-${++n}`;
  const first = walkInFor(null, ' Zoe ', make);
  assert.deepEqual(first, { name: 'Zoe', walkInId: 'id-1' });
  assert.equal(walkInFor(first, 'Zoe', make).walkInId, 'id-1');
  assert.equal(walkInFor(first, 'Max', make).walkInId, 'id-2');
});
test('back goes one step, not always to the list', () => {
  assert.equal(backFrom('check-in'), 'event'); assert.equal(backFrom('edit'), 'event');
  assert.equal(backFrom('event'), 'events'); assert.equal(backFrom('account'), 'events'); assert.equal(backFrom('create'), 'events'); assert.equal(backFrom('login'), 'welcome');
});
