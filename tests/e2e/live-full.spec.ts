import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const qaEmail = process.env.SEALSEND_QA_EMAIL;
const qaPassword = process.env.SEALSEND_QA_PASSWORD;
const output = path.resolve('qa-screenshots', 'live-full');

test.skip(!qaEmail || !qaPassword, 'Temporary production QA credentials are required');

test('authenticated host and guest lifecycle', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Run the stateful production lifecycle once.');
  await mkdir(output, { recursive: true });
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
    }
  });

  let eventId = '';
  let slug = '';
  try {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Password' }).click();
    await page.getByLabel('Email Address').fill(qaEmail!);
    await page.getByLabel('Password').fill(qaPassword!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.context().setExtraHTTPHeaders({ Origin: 'https://sealsend.app' });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.screenshot({ path: path.join(output, '01-dashboard-desktop.png'), fullPage: true });

    await page.goto('/dashboard?plan=pro_annual');
    await expect(page.getByText('Continue with SealSend Pro')).toBeVisible();
    await page.goto('/templates');
    await expect(page.getByRole('heading', { name: 'Event templates' })).toBeVisible();
    await page.getByRole('link', { name: 'Use this template' }).first().click();
    await expect(page).toHaveURL(/\/events\/new\?template=/);
    await page.goto('/ai-assistant');
    await expect(page).toHaveURL(/\/events\/new$/);
    await page.goto('/settings/team');
    await expect(page).toHaveURL(/\/settings$/);

    const aiDraftResponse = await page.context().request.post('/api/ai/event-draft', { data: {
      prompt: 'A client appreciation dinner for forty people in Toronto with business casual attire.',
      timezone: 'America/Toronto',
    }});
    expect(aiDraftResponse.status()).toBe(200);
    const aiDraft = await aiDraftResponse.json();
    expect(aiDraft.draft.event.title).toBeTruthy();
    const acceptDraft = await page.context().request.post(`/api/ai/event-draft/${aiDraft.generationId}/outcome`, { data: { outcome: 'accepted' } });
    expect(acceptDraft.status()).toBe(200);

    const create = await page.context().request.post('/api/events', { data: {
      title: 'SealSend Production QA Event',
      description: 'Temporary automated browser QA event.',
      event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      event_timezone: 'America/Toronto',
      location_name: 'Toronto QA Venue',
      host_name: 'SealSend QA',
      allow_plus_ones: true,
      max_guests_per_rsvp: 3,
      invitation_headline: aiDraft.draft.invitation.headline,
      invitation_body: aiDraft.draft.invitation.body,
      reminder_sequence: aiDraft.draft.reminders,
      ai_generation_id: aiDraft.generationId,
      status: 'draft',
    }});
    expect(create.status()).toBe(201);
    const event = await create.json();
    eventId = event.id;
    slug = event.slug;

    const secondEvent = await page.context().request.post('/api/events', { data: { title: 'Should Be Blocked' } });
    expect(secondEvent.status()).toBe(403);

    const guestCreate = await page.context().request.post(`/api/events/${eventId}/guests`, { data: {
      name: 'QA Guest One', email: 'qa-guest-one@example.com', notes: 'Temporary QA record',
    }});
    expect(guestCreate.status()).toBe(201);
    const guest = await guestCreate.json();

    const bulk = await page.context().request.post(`/api/events/${eventId}/guests/bulk`, { data: [
      { name: 'QA Guest Two', email: 'qa-guest-two@example.com' },
      { name: 'QA Guest Three', email: 'qa-guest-three@example.com' },
    ]});
    expect(bulk.status()).toBe(201);
    expect((await bulk.json()).inserted).toBe(2);

    expect((await page.context().request.post(`/api/events/${eventId}/tags`, { data: { tag_name: 'VIP' } })).status()).toBe(403);
    expect((await page.context().request.post(`/api/events/${eventId}/signups`, { data: { title: 'Bring dessert', slots: 2 } })).status()).toBe(403);

    const magic = await page.context().request.post(`/api/guests/${guest.id}/magic-link`);
    expect(magic.status()).toBe(200);
    expect((await magic.json()).magicLink).toMatch(/^https:\/\/sealsend\.app\/guest\/update\//);

    const publish = await page.context().request.post(`/api/events/${eventId}/publish`);
    expect(publish.status()).toBe(200);
    expect((await publish.json()).status).toBe('published');

    await page.goto(`/events/${eventId}`);
    await expect(page.getByText('SealSend Production QA Event').first()).toBeVisible();
    await page.screenshot({ path: path.join(output, '02-event-dashboard-desktop.png'), fullPage: true });

    await page.goto(`/e/${slug}`);
    await expect(page.getByText('SealSend Production QA Event').first()).toBeVisible();
    await expect(page.getByText(/EDT|EST/).first()).toBeVisible();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(output, '03-public-event-desktop.png'), fullPage: true });

    const rsvp = await page.context().request.post(`/api/rsvp/${slug}`, { data: {
      respondent_name: 'QA Respondent', respondent_email: 'qa-rsvp@example.com',
      status: 'attending', headcount: 2, response_data: { dietary: 'None' },
      plus_ones: [{ name: 'QA Plus One', email: 'qa-plus@example.com' }],
    }});
    expect(rsvp.status()).toBe(200);

    const comment = await page.context().request.post(`/api/comments/${slug}`, { data: {
      author_name: 'QA Respondent', message: 'Looking forward to it!', is_private: false,
    }});
    expect(comment.status()).toBe(201);

    const responses = await page.context().request.get(`/api/events/${eventId}/responses`);
    expect(responses.status()).toBe(200);
    expect((await responses.json())).toHaveLength(1);

    const csv = await page.context().request.get(`/api/events/${eventId}/responses?format=csv`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');

    await page.goto(`/events/${eventId}/responses`);
    await expect(page.getByText('QA Respondent').first()).toBeVisible();
    await page.screenshot({ path: path.join(output, '04-responses-desktop.png'), fullPage: true });

    const checkout = await page.context().request.post('/api/subscriptions/checkout', { data: { plan: 'pro_annual' } });
    expect(checkout.status()).toBe(503);
    expect((await checkout.json()).error).toContain('not configured');

    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  } finally {
    if (eventId) await page.context().request.delete(`/api/events/${eventId}`);
    await page.context().request.post('/api/auth/logout');
  }
});

test('public navigation and responsive layouts', async ({ page }, testInfo) => {
  await mkdir(output, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  for (const route of ['/', '/pricing', '/how-it-works', '/use-cases', '/privacy', '/terms', '/login', '/signup']) {
    const response = await page.goto(route, { waitUntil: 'networkidle' });
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator('body')).not.toContainText('Internal server error');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1);
  }

  await page.goto('/pricing', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(output, `pricing-${testInfo.project.name}.png`), fullPage: true });
  expect(errors).toEqual([]);
});
