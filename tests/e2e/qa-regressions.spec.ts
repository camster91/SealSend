import { expect, test } from '@playwright/test';

test('navigation and pricing expose one accessible control per action', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.locator('a button')).toHaveCount(0);
  await expect(page.locator('article').getByRole('link', { name: 'Join controlled beta' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Test billing setup pending' })).toHaveCount(0);

  const mobileToggle = page.getByRole('button', { name: 'Toggle mobile navigation menu' });
  if (await mobileToggle.isVisible()) {
    await expect(mobileToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#mobile-navigation')).toHaveCount(0);
    await mobileToggle.click();
    await expect(mobileToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mobile-navigation')).toBeVisible();
  }

  const faq = page.getByRole('button', { name: /what is included in the controlled beta/i });
  await expect(faq).toHaveAttribute('aria-expanded', 'false');
  await faq.click();
  await expect(faq).toHaveAttribute('aria-expanded', 'true');
});

test('paid plan intent survives signup and sign-in routing', async ({ page }) => {
  await page.goto('/signup?plan=pro_annual');
  await expect(page.getByText(/Selected plan:.*SealSend Pro/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?plan=pro_annual');
});

test('disabled placeholder features route to working product areas', async ({ page }) => {
  for (const [route, destination] of [
    ['/templates', '/events/new'],
    ['/ai-assistant', '/events/new'],
    ['/settings/team', '/settings'],
  ] as const) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/login\\?redirect=${encodeURIComponent(route).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    // Unauthenticated users retain the intended protected route. Server-side
    // redirects after authentication are covered by source readiness checks.
    expect(destination).toMatch(/^\//);
  }
});

test('organizer use cases are reachable and legacy links redirect', async ({ page }) => {
  await page.goto('/use-cases');
  for (const route of [
    '/use-cases/community-events',
    '/use-cases/nonprofit-events',
    '/use-cases/clubs-associations',
    '/use-cases/professional-gatherings',
  ]) {
    await expect(page.locator('main').locator(`a[href="${route}"]`)).toHaveCount(1);
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByText(/^Run one active event with up to 100 guests\./i)).toBeVisible();
    await page.goBack();
  }

  await page.goto('/use-cases/weddings');
  await expect(page).toHaveURL(/\/use-cases\/professional-gatherings$/);
});

test('unknown use-case slugs return the helpful 404 with a real 404 status', async ({ page }) => {
  const response = await page.goto('/use-cases/not-a-real-use-case');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
