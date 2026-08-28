import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import { hashAuthCode } from '../../src/lib/auth/code-hash';

const qaEmail = process.env.SEALSEND_QA_EMAIL;
const qaPassword = process.env.SEALSEND_QA_PASSWORD;
const qaBetaInviteToken = process.env.SEALSEND_QA_BETA_INVITE_TOKEN;
const allowPendingBetaPolicy = process.env.SEALSEND_QA_ALLOW_PENDING_BETA_POLICY === 'true';
const qaDatabaseUrl = process.env.SEALSEND_QA_DATABASE_URL;
const qaGuestCode = process.env.SEALSEND_QA_GUEST_CODE;
const output = path.resolve('qa-screenshots', 'live-full');

test('authenticated host and guest lifecycle', async ({ browser, page }, testInfo) => {
  test.skip(!qaEmail || !qaPassword || !qaBetaInviteToken, 'Disposable QA credentials and a one-time beta invitation are required');
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
  let repeatedEventId = '';
  let slug = '';
  let betaJoined = false;
  try {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Password' }).click();
    await page.getByLabel('Email Address').fill(qaEmail!);
    await page.getByLabel('Password').fill(qaPassword!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    const origin = new URL(page.url()).origin;
    await page.context().setExtraHTTPHeaders({ Origin: origin });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.screenshot({ path: path.join(output, '01-dashboard-desktop.png'), fullPage: true });

    const betaEnrollment = await page.context().request.post('/api/beta/participation', { data: {
      inviteToken: qaBetaInviteToken, consent: true,
    }});
    if (allowPendingBetaPolicy) {
      expect(betaEnrollment.status()).toBe(409);
      expect((await betaEnrollment.json()).error).toBe('Beta enrollment is not open until the cohort policy is approved.');
    } else {
      expect(betaEnrollment.status()).toBe(201);
      const initialBeta = await betaEnrollment.json();
      expect(initialBeta.participant.active).toBe(true);
      expect(initialBeta.progress.completedRequired).toBe(1);
      betaJoined = true;
    }

    await page.goto('/dashboard?plan=pro_annual');
    await expect(page.getByText('Continue with SealSend Pro')).toHaveCount(0);
    await page.goto('/templates');
    await expect(page.getByRole('heading', { name: 'Event templates' })).toBeVisible();
    await page.getByRole('link', { name: 'Use this template' }).first().click();
    await expect(page).toHaveURL(/\/events\/new\?template=/);
    await page.goto('/ai-assistant');
    await expect(page).toHaveURL(/\/events\/new$/);
    await page.goto('/settings/team');
    await expect(page).toHaveURL(/\/settings$/);

    const aiDraftResponse = await page.context().request.post('/api/ai/event-draft', { data: {
      brief: {
        summary: 'A client appreciation dinner for forty people in Toronto with business casual attire.',
        eventDate: '2026-09-18T23:00:00.000Z',
        locationName: 'Community Hall',
        maxAttendees: 40,
        audience: 'Current clients and their approved guests',
        accessibilityStatus: 'no_known_requirements',
        accessibilityNotes: null,
        communicationPreference: 'email',
      },
      timezone: 'America/Toronto',
    }});
    expect(aiDraftResponse.status()).toBe(200);
    const aiDraft = await aiDraftResponse.json();
    expect(aiDraft.draft.event.title).toBeTruthy();
    const acceptDraft = await page.context().request.post(`/api/ai/event-draft/${aiDraft.generationId}/outcome`, { data: { outcome: 'accepted' } });
    expect(acceptDraft.status()).toBe(200);

    const createData = {
      title: 'SealSend Production QA Event',
      description: 'Temporary automated browser QA event.',
      event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      event_timezone: 'America/Toronto',
      location_name: 'Toronto QA Venue',
      host_name: 'SealSend QA',
      allow_plus_ones: true,
      max_guests_per_rsvp: 3,
      max_attendees: 40,
      invitation_headline: aiDraft.draft.invitation.headline,
      invitation_body: aiDraft.draft.invitation.body,
      reminder_sequence: aiDraft.draft.reminders,
      event_brief: {
        audience: aiDraft.brief.audience,
        accessibilityStatus: aiDraft.brief.accessibilityStatus,
        accessibilityNotes: aiDraft.brief.accessibilityNotes,
        communicationPreference: aiDraft.brief.communicationPreference,
      },
      ai_generation_id: aiDraft.generationId,
      status: 'draft',
    };
    const createResponses = await Promise.all([
      page.context().request.post('/api/events', { data: createData }),
      page.context().request.post('/api/events', { data: {
        ...createData,
        title: 'SealSend Concurrent QA Event',
      }}),
    ]);
    expect(createResponses.map(response => response.status()).sort()).toEqual([201, 403]);
    const create = createResponses.find(response => response.status() === 201)!;
    expect(create.status()).toBe(201);
    const event = await create.json();
    eventId = event.id;
    slug = event.slug;

    const defaultFields = await page.context().request.get(`/api/events/${eventId}/rsvp-fields`);
    expect(defaultFields.status()).toBe(200);
    const defaultFieldData = await defaultFields.json();
    expect(defaultFieldData).toHaveLength(6);
    expect(defaultFieldData.find((field: { field_name: string }) => field.field_name === 'attending')?.options)
      .toEqual(['Joyfully Accepts', 'Regretfully Declines']);

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

    const checkInFallback = await page.context().request.get(`/api/events/${eventId}/guests?format=check-in-csv`);
    expect(checkInFallback.status()).toBe(200);
    expect(checkInFallback.headers()['content-type']).toContain('text/csv');
    expect(checkInFallback.headers()['cache-control']).toContain('no-store');
    expect(checkInFallback.headers()['content-disposition']).toContain('check-in-fallback');
    const fallbackCsv = await checkInFallback.text();
    expect(fallbackCsv).toContain('QA Guest One');
    expect(fallbackCsv).not.toContain('qa-guest-one@example.com');

    const tagCreate = await page.context().request.post(`/api/events/${eventId}/tags`, { data: { tag_name: 'VIP' } });
    expect(tagCreate.status()).toBe(201);
    expect((await tagCreate.json()).tag_name).toBe('VIP');
    const signupCreate = await page.context().request.post(`/api/events/${eventId}/signups`, { data: { title: 'Bring dessert', slots: 2 } });
    expect(signupCreate.status()).toBe(201);
    expect((await signupCreate.json()).title).toBe('Bring dessert');

    const magic = await page.context().request.post(`/api/guests/${guest.id}/magic-link`);
    expect(magic.status()).toBe(200);
    const magicUrl = new URL((await magic.json()).magicLink);
    expect(magicUrl.origin).toBe(origin);
    expect(magicUrl.pathname).toMatch(/^\/guest\/update\/[A-Za-z0-9_-]{43}$/);

    const publish = await page.context().request.post(`/api/events/${eventId}/publish`);
    expect(publish.status()).toBe(200);
    expect((await publish.json()).status).toBe('published');

    if (qaDatabaseUrl && qaGuestCode) {
      expect(process.env.SEALSEND_E2E_FIXTURE_CONFIRM).toBe('isolated');
      expect(new URL(qaDatabaseUrl).pathname).toBe('/sealsend_e2e');
      const pool = new Pool({ connectionString: qaDatabaseUrl, max: 1 });
      try {
        await pool.query(
          `INSERT INTO auth_codes (email, code_hash, role, event_id, expires_at)
           VALUES ($1, $2, 'guest', $3, NOW() + INTERVAL '15 minutes')`,
          ['qa-guest-one@example.com', hashAuthCode({
            code: qaGuestCode,
            recipient: 'qa-guest-one@example.com',
            role: 'guest',
            eventId,
          }), eventId],
        );
      } finally {
        await pool.end();
      }

      const guestContext = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
      try {
        await guestContext.setExtraHTTPHeaders({ Origin: origin });
        const guestLogin = await guestContext.request.post('/api/auth/verify-code', { data: {
          method: 'email', email: 'qa-guest-one@example.com', code: qaGuestCode, eventId,
        }});
        expect(guestLogin.status()).toBe(200);
        expect((await guestLogin.json()).user.role).toBe('guest');
        expect((await guestContext.request.get(`/api/events/${eventId}`)).status()).toBe(403);
        expect((await guestContext.request.get('/api/events')).status()).toBe(403);
        expect((await guestContext.request.get('/api/account/export')).status()).toBe(403);
        expect((await guestContext.request.post('/api/subscriptions/checkout', { data: { plan: 'pro_annual' } })).status()).toBe(403);
        expect((await guestContext.request.get(`/api/events/${eventId}/guests`)).status()).toBe(403);
        expect((await guestContext.request.post('/api/auth/logout')).status()).toBe(200);
      } finally {
        await guestContext.close();
      }
    }

    const calendar = await page.context().request.get(`/api/calendar/${slug}`);
    expect(calendar.status()).toBe(200);
    expect(calendar.headers()['content-type']).toContain('text/calendar');

    const checkIn = await page.context().request.patch(`/api/events/${eventId}/check-in`, { data: {
      guestId: guest.id, checkedIn: true,
    }});
    expect(checkIn.status()).toBe(200);

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

    const summary = await page.context().request.get(`/api/events/${eventId}/responses/summary`);
    expect(summary.status()).toBe(200);
    const summaryData = await summary.json();
    expect(summaryData.sourceResponseCount).toBe(1);
    expect(summaryData.attendingHeadcount).toBe(2);
    expect(summaryData.sourceResponseIds).toHaveLength(1);

    const audience = await page.context().request.post(`/api/events/${eventId}/announcements/audience`, { data: {
      audience: { rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: false },
      channels: ['email'],
    }});
    expect(audience.status()).toBe(200);
    const audienceData = await audience.json();
    expect(audienceData.count).toBe(3);
    expect(audienceData.emailCount).toBe(3);
    expect(audienceData.smsCount).toBe(0);
    expect(audienceData.recipients).toHaveLength(3);

    const messageDraft = await page.context().request.post(`/api/events/${eventId}/announcements/draft`, { data: {
      intent: 'Remind guests to review the event page before arriving.',
      tone: 'warm', length: 'short', urgency: 'normal', channel: 'email',
    }});
    expect(messageDraft.status()).toBe(200);
    const messageDraftData = await messageDraft.json();
    expect(messageDraftData.generationId).toBeTruthy();
    expect(messageDraftData.draft.message).toBeTruthy();
    expect(messageDraftData.fallback).toBe(true);
    const messageFeedback = await page.context().request.post(
      `/api/events/${eventId}/announcements/draft/${messageDraftData.generationId}`,
      { data: { outcome: 'accepted', helpful: true } },
    );
    expect(messageFeedback.status()).toBe(200);

    const scheduledAnnouncement = await page.context().request.post(`/api/events/${eventId}/announcements`, { data: {
      subject: 'Temporary QA announcement',
      message: 'This approved QA announcement is scheduled beyond the test and removed during cleanup.',
      audience: { rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: false },
      channels: ['email'],
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      approved: true,
    }});
    expect(scheduledAnnouncement.status()).toBe(201);

    const feedback = await page.context().request.post('/api/feedback', { data: {
      category: 'setup', rating: 5, message: 'Temporary automated production QA feedback.', mayContact: false,
    }});
    expect(feedback.status()).toBe(201);

    const csv = await page.context().request.get(`/api/events/${eventId}/responses?format=csv`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');

    const accountExport = await page.context().request.get('/api/account/export');
    expect(accountExport.status()).toBe(200);

    await page.goto(`/events/${eventId}/responses`);
    await expect(page.getByText('QA Respondent').first()).toBeVisible();
    await page.screenshot({ path: path.join(output, '04-responses-desktop.png'), fullPage: true });

    const checkout = await page.context().request.post('/api/subscriptions/checkout', { data: { plan: 'pro_annual' } });
    expect(checkout.status()).toBe(503);
    expect((await checkout.json()).error).toContain('controlled beta');

    await page.goto(`/events/${eventId}`);
    await page.getByRole('button', { name: 'Repeat event' }).click();
    const repeatDialog = page.getByRole('dialog', { name: 'Repeat event' });
    await expect(repeatDialog).toBeVisible();
    await repeatDialog.getByLabel('New event title').fill('SealSend Production QA Repeat');
    const repeatStart = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16);
    await repeatDialog.getByLabel('New start date and time').fill(repeatStart);
    await expect(repeatDialog.getByLabel('Archive the current event')).toBeChecked();
    await repeatDialog.getByLabel('Copy reusable guest contacts and tags').check();
    await repeatDialog.getByRole('button', { name: 'Create next event draft' }).click();
    await expect.poll(() => page.url(), { timeout: 10_000 }).not.toContain(`/events/${eventId}`);
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+\/edit$/);
    repeatedEventId = new URL(page.url()).pathname.split('/')[2] || '';
    expect(repeatedEventId).toBeTruthy();

    const repeatedEventResponse = await page.context().request.get(`/api/events/${repeatedEventId}`);
    expect(repeatedEventResponse.status()).toBe(200);
    const repeatedEvent = await repeatedEventResponse.json();
    expect(repeatedEvent.repeated_from_event_id).toBe(eventId);
    expect(repeatedEvent.event_brief).toEqual({
      audience: 'Current clients and their approved guests',
      accessibilityStatus: 'not_reviewed',
      accessibilityNotes: null,
      communicationPreference: 'undecided',
    });

    const sourceEventResponse = await page.context().request.get(`/api/events/${eventId}`);
    expect(sourceEventResponse.status()).toBe(200);
    expect((await sourceEventResponse.json()).status).toBe('archived');

    const repeatedGuests = await page.context().request.get(`/api/events/${repeatedEventId}/guests`);
    expect(repeatedGuests.status()).toBe(200);
    const repeatedGuestData = await repeatedGuests.json();
    expect(repeatedGuestData).toHaveLength(3);
    expect(repeatedGuestData.find((entry: { name: string }) => entry.name === 'QA Guest One')?.notes).toBeNull();
    expect(repeatedGuestData.every((entry: { invite_status: string; reminder_sent_at: string | null }) =>
      entry.invite_status === 'not_sent' && entry.reminder_sent_at === null)).toBe(true);

    const repeatedResponses = await page.context().request.get(`/api/events/${repeatedEventId}/responses`);
    expect(repeatedResponses.status()).toBe(200);
    expect(await repeatedResponses.json()).toHaveLength(0);
    const repeatedTags = await page.context().request.get(`/api/events/${repeatedEventId}/tags`);
    expect(repeatedTags.status()).toBe(200);
    expect((await repeatedTags.json()).map((entry: { tag_name: string }) => entry.tag_name)).toContain('VIP');
    const repeatedSignups = await page.context().request.get(`/api/events/${repeatedEventId}/signups`);
    expect(repeatedSignups.status()).toBe(200);
    const repeatedSignupData = await repeatedSignups.json();
    expect(repeatedSignupData).toHaveLength(1);
    expect(repeatedSignupData[0].title).toBe('Bring dessert');
    expect(repeatedSignupData[0].claims).toHaveLength(0);

    if (betaJoined) {
      const betaEvidence = await page.context().request.get('/api/beta/participation');
      expect(betaEvidence.status()).toBe(200);
      const betaEvidenceData = await betaEvidence.json();
      expect(betaEvidenceData.progress.completedRequired).toBe(9);
      expect(betaEvidenceData.progress.steps.controlledInvite).toBe(false);
      expect(betaEvidenceData.progress.steps.repeatEvent).toBe(true);
    }

    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  } finally {
    if (repeatedEventId) await page.context().request.delete(`/api/events/${repeatedEventId}`);
    if (eventId) await page.context().request.delete(`/api/events/${eventId}`);
    if (betaJoined) await page.context().request.fetch('/api/beta/participation', { method: 'DELETE' });
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
