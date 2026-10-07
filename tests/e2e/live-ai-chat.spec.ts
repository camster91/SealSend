import { expect, test, type Page } from '@playwright/test';

const email = process.env.SEALSEND_TEMPLATE_EMAIL;
const password = process.env.SEALSEND_TEMPLATE_PASSWORD;

// The target server must run with AI_PROVIDER=fake (plus OPENAI_API_KEY and AI_MODEL so chat is on).
test.skip(!email || !password || process.env.SEALSEND_AI_FAKE !== '1', 'Disposable QA account and a fake-AI server are required');

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Password' }).click();
  await page.getByLabel('Email Address').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('host chats an event into shape, then switches to manual and keeps the title', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);
  let eventId: string | undefined;
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/events' && res.status() === 201) {
      eventId = ((await res.json()) as { id: string }).id;
    }
  });
  try {
    await page.goto('/events/new');
    await page.getByRole('button', { name: /Chat with AI/ }).click();

    await page.getByLabel('Your message').fill('Dinner on 2026-10-11 at 18:00 at the Hall');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Dinner').first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /Switch to manual/i }).click();
    await expect(page.getByLabel('Name of your event')).toHaveValue(/Dinner/);
  } finally {
    if (eventId) {
      const del = await page.request.delete(`/api/events/${eventId}`);
      expect(del.ok()).toBe(true);
    }
  }
});
