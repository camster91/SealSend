import { test, expect } from '@playwright/test';

test.describe('Event Creation', () => {
  test('should show create event form', async ({ page }) => {
    // TODO: Authenticate first
    await page.goto('/events/new');
    await expect(page.locator('form')).toBeVisible();
  });

  test('should create a new event', async ({ page }) => {
    // TODO: Authenticate, fill form, submit, verify redirect
    await page.goto('/events/new');
  });

  test('should validate required fields', async ({ page }) => {
    // TODO: Authenticate, submit empty form, check validation errors
    await page.goto('/events/new');
  });
});
