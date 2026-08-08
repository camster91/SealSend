import { test, expect } from '@playwright/test';

test.describe('Public marketing experience', () => {
  test('renders the complete homepage without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('digital invitations');
    await expect(page.getByText(/all features free/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Create your invitation in 4 simple steps/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('pricing and legal pages are reachable', async ({ page }) => {
    for (const [path, heading] of [
      ['/pricing', /pay for one event, or host all year/i],
      ['/privacy', 'Privacy Policy'],
      ['/terms', 'Terms of Service'],
    ] as const) {
      const response = await page.goto(path);
      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
  });

  test('has no horizontal overflow at the configured viewport', async ({ page }) => {
    await page.goto('/');
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  });
});
