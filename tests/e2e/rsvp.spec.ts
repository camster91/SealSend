import { test, expect } from '@playwright/test';

test.describe('Public marketing experience', () => {
  test('renders the complete homepage without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText("Send the invitation. Know who's coming.");
    await expect(page.getByText(/all features free/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'How it works' })).toBeVisible();
    const offer = page.locator('section', { has: page.getByRole('heading', { level: 2, name: 'Your next gathering, free during the beta.', exact: true }) });
    await expect(offer).toBeVisible();
    await expect(offer).toContainText('Create one active event for up to 100 guests.');
    await expect(offer.getByRole('link', { name: 'Create a free event', exact: true })).toHaveAttribute('href', '/signup');
    await expect(page.getByRole('heading', { level: 2, name: /One flat price per event, never per guest/i })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('pricing and legal pages are reachable', async ({ page }) => {
    for (const [path, heading] of [
      ['/pricing', /run one complete event, free, during the beta/i],
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
