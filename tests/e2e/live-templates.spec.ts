import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { EVENT_TEMPLATES } from '../../src/lib/event-templates';

const email = process.env.SEALSEND_TEMPLATE_EMAIL;
const password = process.env.SEALSEND_TEMPLATE_PASSWORD;

test.skip(!email || !password, 'Disposable template QA account is required');

test('all launch templates populate isolated editable drafts at mobile and desktop widths', async ({ page }) => {
  test.setTimeout(120_000);
  const output = path.resolve('qa-screenshots', 'live-templates');
  await mkdir(output, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/login');
  await page.getByRole('button', { name: 'Password' }).click();
  await page.getByLabel('Email Address').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await page.goto('/templates');
    await expect(page.getByRole('heading', { name: 'Event templates' })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(EVENT_TEMPLATES.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(output, `gallery-${width}.png`), fullPage: true });

    for (const template of EVENT_TEMPLATES) {
      const storageKey = `sealsend_event_wizard_draft_${template.id}`;
      await page.evaluate((key) => localStorage.removeItem(key), storageKey);
      await page.goto(`/events/new?template=${template.id}`);
      await expect(page.getByText(`Starting with ${template.name}.`)).toBeVisible();
      await page.waitForTimeout(650);
      const customization = await page.evaluate((key) => {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved).customization : null;
      }, storageKey);
      expect(customization).toMatchObject(template.customization);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
  }

  expect(errors).toEqual([]);
});
