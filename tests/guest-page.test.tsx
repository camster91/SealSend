import { needsSignIn } from '../src/lib/marketing-routes';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { EventDetails } from '../src/components/public-event/EventDetails';
import { RSVPForm } from '../src/components/public-event/RSVPForm';
import { rsvpSubmission, showsField, withAttendanceQuestion } from '../src/lib/rsvp-form';
import type { Event, RSVPField } from '../src/types/database';

const event = {
  id: 'e1', slug: 'garden', title: 'Garden party', event_date: '2026-12-12T20:30:00.000Z', event_timezone: 'America/Toronto', event_end_date: null,
  location_name: 'Rosewood Hall', location_address: '123 Example Street', host_name: 'Priya', description: null, dress_code: null, rsvp_deadline: null,
  invitation_headline: "You're invited: Garden party",
  invitation_body: 'Priya would love for you to join us on Saturday, December 12 at 3:30 PM at Rosewood Hall. Please let us know if you can make it.',
  registry_links: [], customization: {}, updated_at: '2026-01-01T00:00:00.000Z',
} as unknown as Event;
const field = (field_name: string, field_type: string, extra = {}) =>
  ({ id: field_name, field_name, field_type, field_label: field_name, is_required: false, is_enabled: true, sort_order: 1, options: null, placeholder: null, ...extra }) as unknown as RSVPField;

test('details show the weekday, host and directions once each', () => {
  const markup = renderToStaticMarkup(<EventDetails event={event} showTitle={false} />);
  assert.match(markup, /Saturday, December 12/);
  assert.match(markup, /3:30\s?PM/);
  assert.equal(markup.split('Rosewood Hall').length - 1, 1);
  assert.equal(markup.split('123 Example Street').length - 1, 1);
  assert.match(markup, /Hosted by Priya/);
  assert.match(markup, /Get directions/i);
  assert.doesNotMatch(markup, /<h1/);
});

test('generated wording that repeats the details is not shown, host wording is', () => {
  assert.doesNotMatch(renderToStaticMarkup(<EventDetails event={event} />), /would love for you|You&#x27;re invited/);
  const own = { ...event, invitation_headline: 'Come celebrate', invitation_body: 'Bring a hat!' } as Event;
  const markup = renderToStaticMarkup(<EventDetails event={own} />);
  assert.match(markup, /Come celebrate/);
  assert.match(markup, /Bring a hat!/);
  assert.match(markup, /<h1[^>]*>Garden party/);
});

test('every reply asks whether the guest is coming, first', () => {
  const asked = withAttendanceQuestion([field('email', 'email')]);
  assert.equal(asked[0].field_type, 'attendance');
  assert.equal(asked[0].is_required, true);
  const own = field('attendance', 'attendance', { sort_order: 9 });
  assert.deepEqual(withAttendanceQuestion([field('email', 'email'), own]).map(f => f.field_name), ['attendance', 'email']);
  const off = field('attendance', 'attendance', { is_enabled: false });
  assert.equal(withAttendanceQuestion([off]).filter(f => f.is_enabled && f.field_type === 'attendance').length, 1);
  const markup = renderToStaticMarkup(<RSVPForm eventSlug="garden" fields={[field('email', 'email')]} primaryColor="#1b2a4a" />);
  assert.ok(markup.indexOf('Not Attending') < markup.indexOf('Your Name *'));
});

test('a guest who declines is not asked for, or saved with, extra guests', () => {
  const headcount = field('headcount', 'number');
  assert.equal(showsField(headcount, 'not_attending'), false);
  assert.equal(showsField(headcount, 'attending'), true);
  assert.equal(showsField(field('dietary', 'text'), 'not_attending'), false);
  assert.equal(showsField(field('dietary', 'text', { is_required: true }), 'not_attending'), true);
  assert.deepEqual(rsvpSubmission('not_attending', 3, [{ name: 'Sam' }]), { headcount: 1, plus_ones: [] });
  assert.deepEqual(rsvpSubmission('attending', 2, [{ name: ' ' }, { name: 'Sam' }]), { headcount: 2, plus_ones: [{ name: 'Sam' }] });
});

test('the reply comes before messages, and guests can find privacy and help', () => {
  const page = readFileSync('src/app/e/[slug]/page.tsx', 'utf8');
  assert.ok(page.indexOf('<EventDetails') < page.indexOf('<RSVPForm'));
  for (const later of ['<SignupBoard', '<GuestSocial', '<CommentsSection']) assert.ok(page.indexOf('<RSVPForm') < page.indexOf(later), later);
  assert.match(page, /href="\/privacy"/);
  assert.match(page, /href="\/support"/);
  assert.doesNotMatch(page, /ConfettiEffect|Seal and Send/);
  assert.match(page, /unknownLink/);
});

test('a broken invitation link lands on a guest page with no sign-in form', () => {
  const page = readFileSync('src/app/invite/problem/page.tsx', 'utf8');
  assert.match(page, /ask (your|the) host/i);
  assert.doesNotMatch(page, /password|LoginForm/i);
  for (const file of ['src/app/invite/accept/route.ts', 'src/app/guest/update/[token]/route.ts']) {
    assert.match(readFileSync(file, 'utf8'), /\/invite\/problem/);
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\/login\?error/);
  }
  assert.equal(needsSignIn('/invite/problem'), false);
});

test('the default border colour never overrides a chosen one', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  assert.match(css, /@layer base \{\s*\* \{\s*@apply border-border;\s*\}\s*\}/);
});
