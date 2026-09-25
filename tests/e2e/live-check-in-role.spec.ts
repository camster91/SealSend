import { expect, test } from '@playwright/test';

const email = process.env.SEALSEND_CHECKIN_EMAIL;
const password = process.env.SEALSEND_CHECKIN_PASSWORD;
const eventId = process.env.SEALSEND_CHECKIN_EVENT_ID;
const guestId = process.env.SEALSEND_CHECKIN_GUEST_ID;

test.skip(!email || !password || !eventId || !guestId, 'Disposable check-in-only production fixture is required');

test('check-in-only staff can check in guests and nothing more', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Password' }).click();
  await page.getByLabel('Email Address').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().setExtraHTTPHeaders({ Origin: 'https://sealsend.app' });

  const checkInList = await page.context().request.get(`/api/events/${eventId}/check-in`);
  expect(checkInList.status()).toBe(200);
  expect((await checkInList.json()).map((guest: { id: string }) => guest.id)).toContain(guestId);

  const checkIn = await page.context().request.patch(`/api/events/${eventId}/check-in`, {
    data: { guestId, checkedIn: true },
  });
  expect(checkIn.status()).toBe(200);
  expect((await checkIn.json()).checked_in_at).toBeTruthy();

  expect((await page.context().request.patch(`/api/events/${eventId}`, { data: { title: 'Forbidden edit' } })).status()).toBe(404);
  expect((await page.context().request.get(`/api/events/${eventId}/responses?format=csv`)).status()).toBe(404);
  expect((await page.context().request.get(`/api/events/${eventId}/guests?format=check-in-csv`)).status()).toBe(404);
  expect((await page.context().request.get(`/api/events/${eventId}/members`)).status()).toBe(404);
  expect((await page.context().request.post(`/api/events/${eventId}/announcements/audience`, {
    data: { audience: { rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: false }, channels: ['email'] },
  })).status()).toBe(404);
  expect((await page.context().request.post('/api/checkout', { data: { eventId, tier: 'event_pass' } })).status()).toBe(404);

  await page.goto(`/events/${eventId}/check-in`);
  await expect(page.getByRole('heading', { name: 'Guest check-in' })).toBeVisible();
  await expect(page.getByRole('button', { name: /QA Check-in Guest/ })).toContainText('Checked in');

  const checkOut = await page.context().request.patch(`/api/events/${eventId}/check-in`, {
    data: { guestId, checkedIn: false },
  });
  expect(checkOut.status()).toBe(200);
  expect((await checkOut.json()).checked_in_at).toBeNull();
  await page.getByRole('button', { name: 'Refresh guest list' }).click();
  await expect(page.getByRole('button', { name: /QA Check-in Guest/ })).toContainText('Check in');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
});
