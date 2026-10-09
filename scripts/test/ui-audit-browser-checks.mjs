/**
 * Focused UI regressions for the native PostgreSQL browser harness.
 *
 * This suite uses only disposable .test data. It does not open a send modal,
 * approve a message, call a provider, or mutate production data.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";

const IDS = {
  owner: "00000000-0000-4000-8000-000000000060",
  event: "00000000-0000-4000-8000-000000000061",
  guest: "00000000-0000-4000-8000-000000000062",
  response: "00000000-0000-4000-8000-000000000063",
};
const SESSION = "ui-audit-host-session";

async function seed(db) {
  await db.query(
    `INSERT INTO admin_users (id, email, name, password)
     VALUES ($1, 'ui-audit-host@example.test', 'UI Audit Host', 'fixture-password')`,
    [IDS.owner],
  );
  await db.query(
    `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
     VALUES ($1, 'admin', $2, NOW() + INTERVAL '1 hour')`,
    [IDS.owner, SESSION],
  );
  await db.query(
    `INSERT INTO events
       (id, user_id, title, slug, status, event_date, event_timezone,
        location_name, host_name, max_attendees, max_guests_per_rsvp,
        allow_plus_ones, tier)
     VALUES ($1, $2, 'UI audit event', 'ui-audit-event', 'published',
             NOW() + INTERVAL '14 days', 'America/Toronto', 'UI Audit Hall',
             'UI Audit Host', 100, 10, TRUE, 'event_pass')`,
    [IDS.event, IDS.owner],
  );
  await db.query(
    `INSERT INTO rsvp_fields (event_id, field_name, field_label, field_type, is_enabled, is_required, sort_order)
     VALUES ($1, 'attendance', 'Will you attend?', 'attendance', TRUE, TRUE, 0),
            ($1, 'email', 'Email', 'email', TRUE, FALSE, 1),
            ($1, 'headcount', 'Guests', 'number', TRUE, TRUE, 2)`,
    [IDS.event],
  );
  await db.query(
    `INSERT INTO guests (id, event_id, name, email, invite_status, rsvp_status)
     VALUES ($1, $2, 'Keyboard Guest', 'keyboard-guest@example.test', 'sent', 'attending')`,
    [IDS.guest, IDS.event],
  );
  await db.query(
    `INSERT INTO rsvp_responses
       (id, event_id, guest_id, respondent_name, respondent_email, status, headcount, response_data)
     VALUES ($1, $2, $3, 'Keyboard Guest', 'keyboard-guest@example.test', 'attending', 1, '{}'::jsonb)`,
    [IDS.response, IDS.event, IDS.guest],
  );
}

async function cleanup(db) {
  await db.query("DELETE FROM events WHERE id = $1", [IDS.event]);
  await db.query("DELETE FROM user_sessions WHERE session_token = $1", [SESSION]);
  await db.query("DELETE FROM organizations WHERE created_by = $1", [IDS.owner]);
  await db.query("DELETE FROM admin_users WHERE id = $1", [IDS.owner]);
}

/**
 * @param {{browser: import('playwright').Browser, origin: string, db: {query: Function}}} input
 */
export async function uiAuditBrowserChecks({ browser, origin, db }) {
  const screenshotDir = process.env.SEALSEND_AUDIT_SCREENSHOT_DIR;
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  const capture = async (name) => { if (screenshotDir) await page.screenshot({ path: join(screenshotDir, name), fullPage: false }); };
  await seed(db);
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.addCookies([{ name: "sealsend_session", value: SESSION, url: origin }]);
  const page = await context.newPage();
  try {
    // Invalid values remain visible, announce their range, and lock every
    // builder step until a valid value is entered.
    await page.goto(`${origin}/events/${IDS.event}/edit`);
    await page.getByRole("button", { name: "More options", exact: true }).click();
    const capacity = page.getByLabel("Most guests that can come", { exact: true });
    await capacity.fill("0");
    await page.getByRole("alert").filter({ hasText: "Enter a whole number" }).waitFor();
    await capture("01-builder-invalid.png");
    const nextLook = page.getByRole("button", { name: "Next: The look", exact: true });
    assert.equal(await nextLook.isDisabled(), true, "invalid guest limit must block builder navigation");
    for (const invalid of ["1.5", "1e2", "-", "abc", "10001"]) {
      await capacity.fill(invalid);
      assert.equal(await capacity.inputValue(), invalid, "invalid input must remain visible");
      assert.equal(await nextLook.isDisabled(), true, "invalid text must not silently save a prior number");
    }
    await capacity.fill("25");
    await page.getByRole("alert").filter({ hasText: "Enter a whole number" }).waitFor({ state: "detached" });
    assert.equal(await nextLook.isDisabled(), false, "valid guest limit must clear the blocking error");

    // Sorting is a real keyboard target and exposes state to assistive tech.
    await page.goto(`${origin}/events/${IDS.event}/responses`);
    await page.getByRole("button", { name: "Sort by Name", exact: true }).waitFor();
    const nameSort = page.getByRole("button", { name: "Sort by Name", exact: true });
    await nameSort.focus();
    await nameSort.press("Enter");
    assert.equal(await page.locator("th").filter({ hasText: "Name" }).getAttribute("aria-sort"), "ascending");
    await page.getByRole("button", { name: /Sort by Name, currently ascending/ }).press("Enter");
    assert.equal(await page.locator("th").filter({ hasText: "Name" }).getAttribute("aria-sort"), "descending");

    // A real response plus an empty status filter should explain the filtered
    // result instead of claiming that the event has no responses.
    await page.getByRole("button", { name: "Not Attending", exact: true }).click();
    await page.getByText("No responses match this filter.", { exact: true }).waitFor();
    await capture("02-filter-empty.png");

    // Exercise the same sortable table and layout at the supported widths.
    await page.goto(`${origin}/events/${IDS.event}/guests`);
    await page.getByRole("button", { name: "Sort by Name", exact: true }).waitFor();
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
        `guest table overflows at ${width}px`,
      );
      await capture(`03-guests-${width}.png`);
      const axe = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(
        axe.violations.filter((violation) => ["critical", "serious"].includes(violation.impact)),
        [],
        `guest table accessibility at ${width}px`,
      );
    }

    // A failed history read must leave a visible, retryable state and clear it
    // once the next read succeeds. No send or approval action is touched.
    await page.goto(`${origin}/events/${IDS.event}`);
    let failed = false;
    const announcementUrl = `**/api/events/${IDS.event}/announcements`;
    await page.route(announcementUrl, async (route) => {
      if (!failed && route.request().method() === "GET") {
        failed = true;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Synthetic history outage" }),
        });
        return;
      }
      await route.continue();
    });
    await page.reload();
    await page.getByRole("alert").filter({ hasText: "Announcement history could not be loaded" }).waitFor();
    await capture("04-history-retry.png");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Announcement history could not be loaded" }).waitFor({ state: "detached" });
    assert.equal(failed, true);
    await page.unroute(announcementUrl);

    console.log("PASS numeric builder recovery, keyboard sorting/aria-sort, filter copy, responsive table accessibility, and announcement retry");
  } finally {
    await context.close();
    await cleanup(db);
  }
}
