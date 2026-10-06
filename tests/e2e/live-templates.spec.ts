import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { EVENT_TEMPLATES } from '../../src/lib/event-templates';

const email = process.env.SEALSEND_TEMPLATE_EMAIL;
const password = process.env.SEALSEND_TEMPLATE_PASSWORD;

test.skip(!email || !password, 'Disposable template QA account is required');

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Password' }).click();
  await page.getByLabel('Email Address').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('all launch templates populate isolated editable drafts at mobile and desktop widths', async ({ page }) => {
  test.setTimeout(240_000);
  const output = path.resolve('qa-screenshots', 'live-templates');
  await mkdir(output, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await signIn(page);

  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await page.goto('/templates');
    await expect(page.getByRole('heading', { name: 'Event templates' })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(EVENT_TEMPLATES.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(output, `gallery-${width}.png`), fullPage: true });

    for (const template of EVENT_TEMPLATES) {
      let eventId: string | undefined;
      try {
        await page.goto(`/events/new?template=${template.id}`);
        await expect(page.getByText(`Starting with ${template.name}.`)).toBeVisible();
        await page.getByRole('button', { name: /Build it yourself/ }).click();

        // The first save creates the draft; read its id from the create response.
        const created = page.waitForResponse((res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/events');
        await page.getByLabel('Name of your event').fill(`QA ${template.name} ${width}`);
        const response = await created;
        expect(response.status()).toBe(201);
        eventId = (await response.json()).id as string;
        await expect(page.getByText('Saved', { exact: true })).toBeVisible();

        const res = await page.request.get(`/api/events/${eventId}`);
        expect(res.ok()).toBe(true);
        const event = await res.json();
        expect(event.customization).toMatchObject(template.customization);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      } finally {
        // Free the account's one-event limit for the next template.
        if (eventId) {
          const del = await page.request.delete(`/api/events/${eventId}`);
          expect(del.ok()).toBe(true);
        }
      }
    }
  }

  expect(errors).toEqual([]);
});
