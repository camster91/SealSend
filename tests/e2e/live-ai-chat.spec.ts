import { expect, test, type Page } from '@playwright/test';

const email = process.env.SEALSEND_TEMPLATE_EMAIL;
const password = process.env.SEALSEND_TEMPLATE_PASSWORD;

// The target server must run with AI_PROVIDER=fake (that alone turns the chat on; no OpenAI key or model needed).
test.skip(!email || !password || process.env.SEALSEND_AI_FAKE !== '1', 'Disposable QA account and a fake-AI server are required');

// Wide enough that the invite preview shows beside the chat (it's a sheet below lg).
test.use({ viewport: { width: 1280, height: 900 } });

// Exact copy from FakeChatProvider (src/lib/ai/provider.ts) and the chat client.
const FAKE_REPLY = 'Got it. How many guests are you inviting?';
const RESUME_MESSAGE = 'Welcome back! What would you like to change?';
const MESSAGE = 'Dinner on 2026-10-11 at 18:00 at the Hall';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Password' }).click();
  await page.getByLabel('Email Address').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().setExtraHTTPHeaders({ Origin: new URL(page.url()).origin });
}

async function say(page: Page, text: string) {
  await page.getByLabel('Your message').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(FAKE_REPLY).last()).toBeVisible({ timeout: 30_000 });
}

test('host chats an event into shape, comes back to it, then hands over to review', async ({ page }, testInfo) => {
  // One QA account with a one-event limit: a second browser project would find this run's draft.
  test.skip(testInfo.project.name !== 'chromium', 'Run the stateful chat flow once.');
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

    await say(page, MESSAGE);
    // The assistant's update reached the invite, not just the host's own bubble.
    const preview = page.getByRole('complementary', { name: 'Invite preview' });
    await expect(preview.getByText('Dinner').first()).toBeVisible();
    // The name created the draft, and the address bar now points back at this chat.
    await expect(page).toHaveURL(/\/events\/[^/]+\/chat$/, { timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(RESUME_MESSAGE, { exact: true })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Invite preview' }).getByText('Dinner').first()).toBeVisible();

    await say(page, MESSAGE);
    await page.getByRole('button', { name: 'Review & publish' }).click();
    await expect(page).toHaveURL(/step=review/, { timeout: 15_000 });
  } finally {
    if (eventId) {
      const del = await page.request.delete(`/api/events/${eventId}`);
      expect(del.ok()).toBe(true);
    }
  }
});
