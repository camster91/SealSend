import { expect, test } from '@playwright/test';

const email = process.env.SEALSEND_SCHEDULE_EMAIL;
const password = process.env.SEALSEND_SCHEDULE_PASSWORD;
const eventId = process.env.SEALSEND_SCHEDULE_EVENT_ID;
const slug = process.env.SEALSEND_SCHEDULE_SLUG;

test.skip(!email || !password || !eventId || !slug, 'Disposable scheduled-message production fixture is required');

test('future announcements remain queued, can be cancelled, and calendars are usable', async ({ page }) => {
  const calendar = await page.context().request.get(`/api/calendar/${slug}`);
  expect(calendar.status()).toBe(200);
  expect(calendar.headers()['content-type']).toContain('text/calendar');
  expect(calendar.headers()['content-disposition']).toContain(`${slug}.ics`);
  const ics = await calendar.text();
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain(`UID:${eventId}@sealsend.app`);
  expect(ics).toContain('DTSTART:');
  expect(ics).toContain('END:VCALENDAR');

  await page.goto(`/e/${slug}`);
  await expect(page.getByRole('link', { name: 'Google' })).toHaveAttribute('href', /calendar\.google\.com/);
  await expect(page.getByRole('link', { name: 'Apple / iCal' })).toHaveAttribute('href', `/api/calendar/${slug}`);
  await expect(page.getByRole('link', { name: 'Outlook' })).toHaveAttribute('href', /outlook\.live\.com/);

  await page.goto('/login');
  await page.getByRole('button', { name: 'Password' }).click();
  await page.getByLabel('Email Address').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().setExtraHTTPHeaders({ Origin: 'https://sealsend.app' });

  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const create = await page.context().request.post(`/api/events/${eventId}/announcements`, { data: {
    subject: 'Future QA announcement',
    message: 'This is a queued-only production QA announcement and must not dispatch.',
    audience: { rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: false },
    channels: ['email'], scheduledAt, approved: true,
  }});
  expect(create.status()).toBe(201);
  const created = await create.json();
  expect(created.status).toBe('queued');
  expect(created.dispatch).toBeNull();

  const listBefore = await page.context().request.get(`/api/events/${eventId}/announcements`);
  expect(listBefore.status()).toBe(200);
  expect((await listBefore.json()).find((item: { id: string }) => item.id === created.id)?.status).toBe('queued');

  const cancel = await page.context().request.delete(`/api/events/${eventId}/announcements/${created.id}`);
  expect(cancel.status()).toBe(200);
  expect((await cancel.json()).status).toBe('cancelled');

  const listAfter = await page.context().request.get(`/api/events/${eventId}/announcements`);
  expect((await listAfter.json()).find((item: { id: string }) => item.id === created.id)?.status).toBe('cancelled');
});
