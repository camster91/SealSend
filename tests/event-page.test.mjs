import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/app/(dashboard)/events/[eventId]/page.tsx', 'utf8');
const at = (text) => { const index = page.indexOf(text); assert.ok(index > 0, `missing ${text}`); return index; };

test('the event page leads with the four host jobs', () => {
  const more = at('<summary');
  for (const part of ['<ShareEventButton', 'label="Who&apos;s coming"', 'label="Send update"', 'label="Edit"', 'rsvp-summary-heading']) {
    assert.ok(at(part) < more, part);
  }
});

test('everything else is kept, under More', () => {
  const more = at('<summary');
  for (const part of ['label="Responses"', 'label="Sign-ups"', 'label="Messages"', 'label="Analytics"', '<HostSocial', '<ExportTools', '<EventTeamPanel', '<EventClientPanel', '<CloneEventButton', '<DeleteEventButton', '<AutoRemindersToggle', '/qr`', '<UpgradeButton', '<SmsTopUpButton']) {
    assert.ok(at(part) > more, part);
  }
});

test('door staff and event day keep check-in up front', () => {
  assert.ok(at('{showCheckInFirst &&') < at('<summary'));
  assert.match(page, /access\.role === 'check_in' \|\| isNearEvent/);
});

test('the page drops internal details', () => {
  assert.doesNotMatch(page, /label="Slug"|label="Created"| tier`/);
});

test('event dates on the dashboard are readable', () => {
  const dashboard = readFileSync('src/app/(dashboard)/dashboard/page.tsx', 'utf8');
  assert.doesNotMatch(dashboard, /toLocaleDateString\(\)/);
  assert.match(dashboard, /formatShortDay\(event\.event_date, event\.event_timezone\)/);
});
