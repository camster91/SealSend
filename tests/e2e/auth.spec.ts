import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows the administrator login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Code' })).toBeVisible();
  });

  test('redirects unauthenticated users from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/redirect=%2Fdashboard/);
    await expect(page.getByLabel('Email Address')).toBeVisible();
  });

  test('rejects a cross-site authentication mutation', async ({ request }) => {
    const response = await request.post('/api/auth/send-code', {
      headers: { Origin: 'https://attacker.example' },
      data: { method: 'email', email: 'qa@example.com' },
    });

    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  test('rejects a malformed guest magic token', async ({ page }) => {
    await page.goto('/guest/update/not-a-valid-token');
    await expect(page).toHaveURL(/\/login\?error=invalid_invite/);
  });
});
