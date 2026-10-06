import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

async function expectAccessibleAndContained(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking, `${label}: ${blocking.map((v) => `${v.id} (${v.nodes.length})`).join(', ')}`).toEqual([]);
}

for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
  test(`host builds, publishes and edits an invite at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    const output = path.resolve('qa-screenshots', 'live-builder');
    await mkdir(output, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await signIn(page);
    let eventId: string | undefined;
    try {
      // Start screen
      await page.goto('/events/new');
      await expect(page.getByRole('heading', { name: 'What are you planning?' })).toBeVisible();
      await expectAccessibleAndContained(page, 'start');
      await page.getByRole('button', { name: /Build it yourself/ }).click();

      // Basics: name, date, place. The first save creates the draft.
      const created = page.waitForResponse((res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/events');
      await page.getByLabel('Name of your event').fill(`QA builder ${viewport.width}`);
      const response = await created;
      eventId = (await response.json()).id as string;
      const start = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      await page.getByLabel('Starts').fill(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T18:00`);
      await page.getByLabel('Place name').fill('QA Hall');
      await page.getByLabel('Address').fill('123 Main St, Toronto');
      await expect(page.getByText('Saved', { exact: true })).toBeVisible();
      await expectAccessibleAndContained(page, 'basics');
      await page.screenshot({ path: path.join(output, `basics-${viewport.width}.png`), fullPage: true });

      // Reload: the draft resumes.
      await page.goto('/events/new');
      await expect(page.getByRole('heading', { name: 'Continue your draft' })).toBeVisible();
      await page.getByRole('link', { name: 'Continue your draft' }).click();
      await expect(page).toHaveURL(new RegExp(`/events/${eventId}/build`));
      await expect(page.getByLabel('Name of your event')).toHaveValue(`QA builder ${viewport.width}`);
      await expect(page.getByLabel('Place name')).toHaveValue('QA Hall');

      // Look
      await page.getByRole('button', { name: /Next: The look/ }).click();
      await expect(page.getByLabel('Main colour')).toBeVisible();
      await expectAccessibleAndContained(page, 'look');

      // Guests
      await page.getByRole('button', { name: /^Next: / }).click();
      await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
      await expectAccessibleAndContained(page, 'guests');
      await page.getByRole('button', { name: 'Add guests later' }).click();

      // Review, publish
      await expect(page.getByRole('heading', { name: 'Must-haves' })).toBeVisible();
      await expectAccessibleAndContained(page, 'review');
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Your invite is live' })).toBeVisible();
      await expectAccessibleAndContained(page, 'published');
      await page.screenshot({ path: path.join(output, `published-${viewport.width}.png`), fullPage: true });

      // Edit: change the title, see Saved, reload, still published.
      await page.goto(`/events/${eventId}/edit`);
      const title = page.getByLabel('Name of your event');
      await expect(title).toHaveValue(`QA builder ${viewport.width}`);
      await title.fill(`QA builder ${viewport.width} edited`);
      await expect(page.getByText('Saved', { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByLabel('Name of your event')).toHaveValue(`QA builder ${viewport.width} edited`);
      const event = await (await page.request.get(`/api/events/${eventId}`)).json();
      expect(event.status).toBe('published');
      expect(event.title).toBe(`QA builder ${viewport.width} edited`);
      await expectAccessibleAndContained(page, 'edit');
    } finally {
      // Free the account's one-event limit for the next viewport.
      if (eventId) await page.request.delete(`/api/events/${eventId}`);
    }

    expect(errors).toEqual([]);
  });
}
