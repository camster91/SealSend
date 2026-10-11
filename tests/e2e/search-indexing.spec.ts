import { expect, test } from '@playwright/test';

test('marketing remains indexable while signup pages are excluded', async ({ page }) => {
  for (const path of ['/', '/rsvp-tracking', '/qr-event-check-in']) {
    const response = await page.goto(path);
    expect(response?.headers()['x-robots-tag']).toBeUndefined();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  }
  const response = await page.goto('/signup');
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('application redirects, invalid token pages and API responses are excluded', async ({ request }) => {
  for (const path of ['/dashboard', '/settings', '/team/invite/invalid', '/invite/accept', '/client/invalid', '/unsubscribe/invalid', '/api/events']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()['x-robots-tag'], path).toBe('noindex, nofollow');
  }
});
