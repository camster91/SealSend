import { test, expect } from '@playwright/test';

test.describe('Protected event creation', () => {
  test('redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/events/new');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fevents%2Fnew/);
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('homepage CTA leads to account creation', async ({ page }) => {
    await page.goto('/');
    // BETA_MODE is on, so the primary CTA is the beta variant (see src/components/marketing/Cta.tsx).
    const cta = page.getByRole('main').getByRole('link', { name: 'Create a free event' }).first();
    await expect(cta).toHaveAttribute('href', '/signup');
    await Promise.all([
      page.waitForURL(/\/signup$/, { timeout: 15_000 }),
      cta.click(),
    ]);
    await expect(page.getByRole('button', { name: 'Email my sign-in code' })).toBeVisible();
  });
});

test('sample invitation leads naturally to a free event', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try a sample invitation', exact: true }).click();
  await expect(page).toHaveURL(/#try-invitation$/);
  const demo = page.getByRole('region', { name: 'Try an invitation' });
  await expect(demo).toBeVisible();
  await demo.getByRole('button', { name: 'Try an RSVP', exact: true }).click();
  await expect(demo.getByRole('status')).toContainText('No RSVP was sent.');
  await demo.getByRole('link', { name: 'Make your own invitation', exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole('button', { name: 'Email my sign-in code' })).toBeVisible();
});
