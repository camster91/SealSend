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
    const cta = page.getByRole('main').getByRole('link', { name: 'Join the free beta' }).first();
    await expect(cta).toHaveAttribute('href', '/signup');
    await Promise.all([
      page.waitForURL(/\/signup$/, { timeout: 15_000 }),
      cta.click(),
    ]);
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  });
});
