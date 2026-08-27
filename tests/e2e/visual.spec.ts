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
  await expect(page.getByRole('heading', { level: 1, name: /run one complete event in the controlled beta/i })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, `${prefix}-pricing.png`), fullPage: true });

  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Send Code' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, `${prefix}-login.png`), fullPage: true });
});

test('captures release pages at 375, 768, and 1440 pixels with reduced motion', async ({ page }) => {
  const output = path.resolve('qa-screenshots', 'viewports');
  await mkdir(output, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    for (const [route, name] of [['/', 'home'], ['/pricing', 'pricing'], ['/events/new', 'protected-create']] as const) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        `${route} at ${width}px: horizontal overflow`,
      ).toBeLessThanOrEqual(1);
    }
  }
});
