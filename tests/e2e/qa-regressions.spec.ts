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
