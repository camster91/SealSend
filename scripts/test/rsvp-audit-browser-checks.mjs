/**
 * RSVP regression checks for the native local browser harness.
 *
 * This is deliberately an exported helper instead of an optional Playwright
 * spec: CI always runs it with the disposable database and server already
 * owned by social-browser-qa.mjs. No provider, email address, or production
 * record is used.
 */
import assert from 'node:assert/strict';

export async function rsvpAuditBrowserChecks({ browser, origin, db, host }) {
  const owner = '00000000-0000-4000-8000-000000000010';
  const event = '00000000-0000-4000-8000-000000000041';
  const slug = 'rsvp-audit-fields';
  let responseId;
  const guestContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const guest = await guestContext.newPage();

  try {
    await db.query(
      `INSERT INTO events
         (id, user_id, title, slug, status, event_date, event_timezone, location_name, host_name)
       VALUES ($1, $2, 'RSVP field audit', $3, 'published', NOW() + INTERVAL '14 days',
               'America/Toronto', 'QA Hall', 'QA Host')`,
      [event, owner, slug],
    );
    await db.query(
      `INSERT INTO rsvp_fields
         (event_id, field_name, field_label, field_type, options, is_enabled, is_required, sort_order)
       VALUES
         ($1, 'attendance', 'Will you attend?', 'attendance', NULL, TRUE, TRUE, 0),
         ($1, 'meal_preferences', 'Meal preferences', 'multiselect', '["Vegetarian","Vegan"]', TRUE, TRUE, 1),
         ($1, 'notes', 'Notes', 'textarea', NULL, TRUE, TRUE, 2)`,
      [event],
    );

    await guest.goto(`${origin}/e/${slug}`);
    await guest.getByRole('form', { name: 'RSVP' }).waitFor();
    await guest.getByRole('button', { name: 'Submit RSVP', exact: true }).waitFor();
    await guest.getByLabel('Your Name *', { exact: true }).fill('RSVP field audit');
    await guest.getByRole('button', { name: 'Attending', exact: true }).click();
    await guest.getByLabel(/^Notes\s*\*?$/, { exact: false }).fill('Please seat me near the aisle.');
    const mealField = guest.locator('fieldset').filter({ hasText: 'Meal preferences' });
    await guest.getByRole('button', { name: 'Submit RSVP', exact: true }).click();
    await mealField.getByText('Meal preferences is required.', { exact: true }).waitFor();
    assert.equal(await mealField.getAttribute('aria-invalid'), 'true');
    await guest.getByRole('checkbox', { name: 'Vegetarian', exact: true }).check();
    assert.equal(await mealField.getAttribute('aria-invalid'), null);
    assert.equal(await mealField.getByText('Meal preferences is required.', { exact: true }).count(), 0);

    const submit = guest.waitForResponse((response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/rsvp/${slug}`,
    );
    await guest.getByRole('button', { name: 'Submit RSVP', exact: true }).click();
    assert.equal((await submit).status(), 200);
    await guest.getByText('Your response has been recorded.', { exact: true }).waitFor();

    const row = (await db.query(
      'SELECT id, status, response_data FROM rsvp_responses WHERE event_id = $1',
      [event],
    )).rows[0];
    assert.ok(row, 'the custom-field RSVP should be persisted');
    responseId = row.id;
    assert.deepEqual(row.response_data.meal_preferences, ['Vegetarian']);
    assert.equal(row.response_data.notes, 'Please seat me near the aisle.');

    // Choice edits must keep an authorized historical answer visible and
    // editable, while rejecting a fabricated new option.
    await db.query("UPDATE rsvp_fields SET options = '[\"Vegan\",\"Gluten-free\"]'::jsonb WHERE event_id = $1 AND field_name = 'meal_preferences'", [event]);
    await guest.reload();
    await guest.getByRole('button', { name: 'Update your response', exact: true }).click();
    const legacyChoice = guest.getByRole('checkbox', { name: /Vegetarian.*previously selected/ });
    await legacyChoice.waitFor();
    assert.equal(await legacyChoice.isChecked(), true);
    const invalid = await guest.request.post(`${origin}/api/rsvp/${slug}`, {
      headers: { Origin: origin },
      data: {
        respondent_name: 'RSVP field audit',
        status: 'attending',
        headcount: 1,
        response_data: { meal_preferences: ['Fabricated'], notes: 'Please seat me near the aisle.' },
      },
    });
    assert.equal(invalid.status(), 400, await invalid.text());
    await guest.getByRole('button', { name: 'Submit RSVP', exact: true }).click();
    await guest.getByText('Your response has been recorded.', { exact: true }).waitFor();
    assert.deepEqual((await db.query('SELECT response_data FROM rsvp_responses WHERE id = $1', [responseId])).rows[0].response_data.meal_preferences, ['Vegetarian']);

    const summary = await host.request.get(`${origin}/api/events/${event}/responses/summary`);
    assert.equal(summary.status(), 200, await summary.text());
    const summaryBody = await summary.json();
    const mealSummary = summaryBody.fields.find((field) => field.fieldName === 'meal_preferences');
    assert.equal(mealSummary.answered, 1);
    assert.deepEqual(mealSummary.counts, [{ value: 'Vegetarian', count: 1 }]);

    const csv = await host.request.get(`${origin}/api/events/${event}/responses?format=csv`);
    assert.equal(csv.status(), 200, await csv.text());
    const csvBody = await csv.text();
    assert.match(csvBody, /Vegetarian/);
    assert.match(csvBody, /Please seat me near the aisle\./);
    assert.doesNotMatch(csvBody, /Vegetarian,Vegan/);

    const deleted = await host.request.delete(`${origin}/api/events/${event}/responses/${responseId}`, {
      headers: { Origin: origin },
    });
    assert.equal(deleted.status(), 200, await deleted.text());
    assert.equal(
      (await db.query('SELECT COUNT(*)::int AS count FROM rsvp_responses WHERE event_id = $1', [event])).rows[0].count,
      0,
    );
    console.log('PASS custom textarea/multiselect persistence, summary counts, CSV serialization, and response deletion');
  } finally {
    await guestContext.close();
    await db.query('DELETE FROM events WHERE id = $1 AND user_id = $2', [event, owner]);
  }
}
