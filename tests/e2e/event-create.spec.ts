import { test, expect } from '@playwright/test';

test.describe('Protected event creation', () => {
  test('redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/events/new');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fevents%2Fnew/);
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('homepage CTA leads to account creation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Build Your Event Draft' }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  });
});
