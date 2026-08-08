import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('captures the homepage and login experience for visual review', async ({ page }, testInfo) => {
  const output = path.resolve('qa-screenshots');
  await mkdir(output, { recursive: true });
  const prefix = testInfo.project.name;

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(output, `${prefix}-homepage.png`), fullPage: true });

  await page.goto('/pricing');
  await expect(page.getByRole('heading', { level: 1, name: /pay for one event/i })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, `${prefix}-pricing.png`), fullPage: true });

  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Send Code' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, `${prefix}-login.png`), fullPage: true });
});
