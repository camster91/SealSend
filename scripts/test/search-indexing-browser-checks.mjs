import assert from 'node:assert/strict';

export async function searchIndexingBrowserChecks({ browser, origin }) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, extraHTTPHeaders: { DNT: '1' } });
  try {
    const page = await context.newPage();
    for (const path of ['/e/social-qa', `/e/social-qa?t=${'a'.repeat(24)}`, '/events/00000000-0000-4000-8000-000000000011/guest']) {
      const response = await page.goto(`${origin}${path}`);
      assert.equal(response.status(), 200);
      assert.equal(response.headers()['x-robots-tag'], 'noindex, nofollow');
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
      if (path.startsWith('/e/')) {
        assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), 'Social QA event');
        await page.getByRole('form', { name: 'RSVP' }).waitFor();
      } else {
        await page.getByRole('heading', { name: 'Guest access', exact: true }).waitFor();
      }
    }
    const absent = await context.request.get(`${origin}/e/search-indexing-absent`);
    assert.equal(absent.status(), 404);
    assert.equal(absent.headers()['x-robots-tag'], 'noindex, nofollow');
    console.log('PASS invitation and token URLs, guest login, unknown events: noindex; link previews and RSVP remain available');
  } finally {
    await context.close();
  }
}
