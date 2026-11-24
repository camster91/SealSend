import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { audienceFor } from '../src/lib/messages/update-audience.ts';

const modal = readFileSync('src/components/dashboard/SendAnnouncementModal.tsx', 'utf8');

test('each simple choice selects the right guests', () => {
  const none = { rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: false };
  assert.deepEqual(audienceFor('everyone'), none);
  assert.deepEqual(audienceFor('yes'), { ...none, rsvpStatuses: ['attending'] });
  assert.deepEqual(audienceFor('waiting'), { ...none, unansweredOnly: true });
});

test('the form leads with a message and three choices, with the rest under More options', () => {
  const more = modal.indexOf('More options');
  for (const part of ['id="ann-subject"', 'id="ann-message"', 'Who gets it?']) {
    assert.ok(modal.indexOf(part) > 0 && modal.indexOf(part) < more, part);
  }
  for (const part of ['Help me write it', 'Invitation status', 'Guest tags', 'id="ann-schedule"']) {
    assert.ok(modal.indexOf(part) > more, part);
  }
});

test('nothing is sent without a review and the host confirming the guests', () => {
  assert.match(modal, /if \(!preview \|\| !confirmed\) return;/);
  assert.match(modal, /These guests know me and expect to hear from me/);
  assert.match(modal, /I&apos;ve checked this message and who gets it/);
  assert.match(modal, /approvalProof: preview\.approvalProof/);
  assert.match(modal, /disabled=\{!confirmed \|\| preview\.count === 0\}/);
});

test('hosts read plain words', () => {
  assert.doesNotMatch(modal, /Resolved audience|Target RSVP state|Target invitation state|external send|Plan announcement|Dispatch/);
});

test('planner tools are tucked away in Settings, after the account and password', () => {
  const settings = readFileSync('src/app/(dashboard)/settings/page.tsx', 'utf8');
  const planner = settings.indexOf('Tools for event planners');
  assert.ok(planner > settings.indexOf('Change Password'));
  for (const link of ['/settings/brand', '/settings/team', '/settings/clients', '/settings/integrations']) {
    assert.ok(settings.indexOf(link) > planner, link);
  }
});
