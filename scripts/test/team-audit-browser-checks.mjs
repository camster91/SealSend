/**
 * Authenticated workspace/event-team regressions for the native PostgreSQL
 * browser harness. The fixture is disposable and uses only .test addresses;
 * Mailgun is deliberately left unconfigured so invitation delivery is tested
 * as a recoverable failure rather than sending a message.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const IDS = {
  planner: "00000000-0000-4000-8000-000000000031",
  owner: "00000000-0000-4000-8000-000000000032",
  organization: "00000000-0000-4000-8000-000000000033",
  client: "00000000-0000-4000-8000-000000000034",
  brand: "00000000-0000-4000-8000-000000000035",
  event: "00000000-0000-4000-8000-000000000036",
  outsider: "00000000-0000-4000-8000-000000000037",
};
const OWNER_SESSION = "team-audit-owner-session";
const PLANNER_SESSION = "team-audit-planner-session";
const OUTSIDER_SESSION = "team-audit-outsider-session";

async function captureAuditScreenshot(page, filename, { redactInviteLink = false } = {}) {
  const directory = process.env.SEALSEND_AUDIT_SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  if (redactInviteLink) {
    await page.locator("code").evaluate((element) => {
      element.textContent = "[one-time invite link redacted for evidence]";
    });
  }
  await page.screenshot({ path: join(directory, filename), fullPage: true });
}

async function seed(db) {
  await db.query(
    `INSERT INTO admin_users (id, email, name, password)
     VALUES ($1, 'team-audit-planner@example.test', 'Team Audit Planner', 'fixture-password'),
            ($2, 'team-audit-owner@example.test', 'Team Audit Owner', 'fixture-password'),
            ($3, 'team-audit-outsider@example.test', 'Team Audit Outsider', 'fixture-password')`,
    [IDS.planner, IDS.owner, IDS.outsider],
  );
  await db.query(
    `INSERT INTO organizations (id, name, slug, plan, is_personal, created_by)
     VALUES ($1, 'Team Audit Workspace', 'team-audit-workspace', 'studio', FALSE, $2)`,
    [IDS.organization, IDS.owner],
  );
  await db.query(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, 'owner'), ($1, $3, 'planner')`,
    [IDS.organization, IDS.owner, IDS.planner],
  );
  await db.query(
    `INSERT INTO clients (id, organization_id, name)
     VALUES ($1, $2, 'Team Audit Client')`,
    [IDS.client, IDS.organization],
  );
  await db.query(
    `INSERT INTO brands (id, organization_id, name, primary_color)
     VALUES ($1, $2, 'Team Audit Brand', '#224466')`,
    [IDS.brand, IDS.organization],
  );
  await db.query(
    `INSERT INTO events
       (id, user_id, title, slug, status, event_date, event_timezone,
        location_name, host_name, organization_id, client_id, brand_id)
     VALUES ($1, $2, 'Planner Workspace Event', 'team-audit-event', 'published',
             NOW() + INTERVAL '14 days', 'America/Toronto', 'Team Audit Hall',
             'Team Audit Planner', $3, $4, $5)`,
    [IDS.event, IDS.planner, IDS.organization, IDS.client, IDS.brand],
  );
  await db.query(
    `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
     VALUES ($1, 'admin', $2, NOW() + INTERVAL '1 hour'),
            ($3, 'admin', $4, NOW() + INTERVAL '1 hour'),
            ($5, 'admin', $6, NOW() + INTERVAL '1 hour')`,
    [IDS.owner, OWNER_SESSION, IDS.planner, PLANNER_SESSION, IDS.outsider, OUTSIDER_SESSION],
  );
}

async function cleanup(db) {
  await db.query("DELETE FROM organization_invites WHERE organization_id = $1", [IDS.organization]);
  await db.query("DELETE FROM event_member_invites WHERE event_id = $1", [IDS.event]);
  await db.query("DELETE FROM event_audit_log WHERE event_id = $1", [IDS.event]);
  await db.query("DELETE FROM user_sessions WHERE session_token IN ($1, $2, $3)", [OWNER_SESSION, PLANNER_SESSION, OUTSIDER_SESSION]);
  await db.query("DELETE FROM events WHERE repeated_from_event_id = $1", [IDS.event]);
  await db.query("DELETE FROM events WHERE id = $1", [IDS.event]);
  await db.query("DELETE FROM brands WHERE id = $1", [IDS.brand]);
  await db.query("DELETE FROM clients WHERE id = $1", [IDS.client]);
  await db.query("DELETE FROM organization_members WHERE organization_id = $1", [IDS.organization]);
  await db.query("DELETE FROM organizations WHERE id = $1", [IDS.organization]);
  await db.query("DELETE FROM admin_users WHERE id IN ($1, $2, $3)", [IDS.planner, IDS.owner, IDS.outsider]);
}

/**
 * Run team workflow checks inside the caller's already-running QA server.
 * @param {{browser: import('playwright').Browser, origin: string, db: {query: Function}}} input
 */
export async function teamAuditBrowserChecks({ browser, origin, db }) {
  await seed(db);
  const context = await browser.newContext({ ignoreHTTPSErrors: true, permissions: ["clipboard-read", "clipboard-write"] });
  await context.addCookies([{ name: "sealsend_session", value: OWNER_SESSION, url: origin }]);
  const page = await context.newPage();
  const plannerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  await plannerContext.addCookies([{ name: "sealsend_session", value: PLANNER_SESSION, url: origin }]);
  const outsiderContext = await browser.newContext({ ignoreHTTPSErrors: true });
  await outsiderContext.addCookies([{ name: "sealsend_session", value: OUTSIDER_SESSION, url: origin }]);
  try {
    await page.goto(`${origin}/dashboard`);
    await page.getByRole("heading", { name: "Collaborating events", exact: true }).waitFor();
    await page.getByRole("link", { name: /Planner Workspace Event/ }).waitFor();
    assert.equal(await page.getByText("Workspace owner", { exact: true }).count(), 1, "workspace role should be visible on shared event");
    await captureAuditScreenshot(page, "05-dashboard-team.png");

    const cloneResponse = await page.request.post(`${origin}/api/events/${IDS.event}/clone`, {
      headers: { Origin: origin },
      data: {
        title: "Planner Workspace Event - next event",
        eventDate: new Date(Date.now() + 21 * 86400000).toISOString(),
        eventEndDate: null,
        rsvpDeadline: null,
        includeGuests: false,
        archiveSource: true,
      },
    });
    assert.equal(cloneResponse.status(), 201, await cloneResponse.text());
    const cloneBody = await cloneResponse.json();
    const cloneId = cloneBody.event?.id;
    assert.match(cloneId, /^[0-9a-f-]{36}$/i, "repeat should return the new event");
    const clone = (await db.query(
      "SELECT user_id, organization_id, client_id, brand_id, status FROM events WHERE id = $1",
      [cloneId],
    )).rows[0];
    assert.equal(clone.user_id, IDS.planner, "repeat must retain the source event owner for quota and lineage");
    assert.equal(clone.organization_id, IDS.organization, "repeat must stay in the source workspace");
    assert.equal(clone.client_id, IDS.client, "repeat must retain the workspace client");
    assert.equal(clone.brand_id, IDS.brand, "repeat must retain the source brand context");
    assert.equal(clone.status, "draft");
    await db.query("UPDATE events SET status = 'archived' WHERE id = $1", [cloneId]);

    const creatorRepeat = await plannerContext.request.post(`${origin}/api/events/${IDS.event}/clone`, {
      headers: { Origin: origin },
      data: {
        title: "Planner Workspace Event - creator repeat",
        eventDate: new Date(Date.now() + 28 * 86400000).toISOString(),
        eventEndDate: null,
        rsvpDeadline: null,
        includeGuests: false,
        archiveSource: false,
      },
    });
    assert.equal(creatorRepeat.status(), 201, await creatorRepeat.text());
    const creatorCloneId = (await creatorRepeat.json()).event?.id;
    assert.match(creatorCloneId, /^[0-9a-f-]{36}$/i, "creator repeat should return the new event");
    const creatorClone = (await db.query(
      "SELECT user_id, organization_id, client_id, brand_id, status FROM events WHERE id = $1",
      [creatorCloneId],
    )).rows[0];
    assert.equal(creatorClone.user_id, IDS.planner, "creator repeat must retain the direct event owner");
    assert.equal(creatorClone.organization_id, IDS.organization, "creator repeat must retain the source workspace");
    assert.equal(creatorClone.client_id, IDS.client, "creator repeat must retain the workspace client");
    assert.equal(creatorClone.brand_id, IDS.brand, "creator repeat must retain the source brand context");
    assert.equal(creatorClone.status, "draft");
    await db.query("UPDATE events SET status = 'archived' WHERE id = $1", [creatorCloneId]);

    // Event access deliberately fails closed with 404 for outsiders so the
    // existence of a private event is not disclosed.
    const outsiderClone = await outsiderContext.request.post(`${origin}/api/events/${IDS.event}/clone`, {
      headers: { Origin: origin },
      data: {
        title: "Outsider must not repeat",
        eventDate: new Date(Date.now() + 35 * 86400000).toISOString(),
        eventEndDate: null,
        rsvpDeadline: null,
        includeGuests: false,
        archiveSource: false,
      },
    });
    assert.equal(outsiderClone.status(), 404, "outsider repeat must fail closed");

    await db.query(
      "UPDATE organization_members SET role = 'admin' WHERE organization_id = $1 AND user_id = $2",
      [IDS.organization, IDS.owner],
    );
    const eventInvite = await page.request.post(`${origin}/api/events/${IDS.event}/members`, {
      headers: { Origin: origin },
      data: { email: "event-team-audit@example.test", role: "manager" },
    });
    assert.equal(eventInvite.status(), 201, await eventInvite.text());
    const eventInviteRow = (await db.query(
      "SELECT role FROM event_member_invites WHERE event_id = $1 AND LOWER(email) = LOWER($2)",
      [IDS.event, "event-team-audit@example.test"],
    )).rows[0];
    assert.equal(eventInviteRow.role, "manager", "workspace admin should be able to invite to a planner-owned event");

    const outsiderInvite = await outsiderContext.request.post(`${origin}/api/events/${IDS.event}/members`, {
      headers: { Origin: origin },
      data: { email: "outsider-event-team-audit@example.test", role: "manager" },
    });
    assert.equal(outsiderInvite.status(), 404, "outsider event invite must fail closed");

    await page.goto(`${origin}/settings/team`);
    // The settings page may initially select the personal workspace while
    // organizations load. The invite form is intentionally hidden there, so
    // select the seeded team workspace before asserting its controls.
    const workspacePicker = page.locator("select").first();
    await workspacePicker.waitFor({ state: "visible" });
    await workspacePicker.locator(`option[value="${IDS.organization}"]`).waitFor({ state: "attached" });
    await workspacePicker.selectOption(IDS.organization);
    await page.getByLabel("Invite by email").waitFor();
    await page.getByLabel("Invite by email").fill("workspace-team-audit@example.test");

    // Exercise the recoverable network failure before the provider failure.
    // The input remains populated, so the owner can retry the same invite.
    const inviteMembersUrl = `**/api/organizations/${IDS.organization}/members`;
    let abortedInvite = false;
    const abortFirstInvite = async (route) => {
      if (!abortedInvite && route.request().method() === "POST") {
        abortedInvite = true;
        await route.abort("failed");
        return;
      }
      await route.continue();
    };
    await page.route(inviteMembersUrl, abortFirstInvite);
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await page.getByText("The request could not be completed. Please try again.", { exact: true }).waitFor();
    await page.unroute(inviteMembersUrl, abortFirstInvite);

    const inviteResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "POST" && response.url().endsWith(`/api/organizations/${IDS.organization}/members`),
    );
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    const inviteResponse = await inviteResponsePromise;
    const inviteBody = await inviteResponse.json();
    assert.equal(inviteResponse.status(), 201, JSON.stringify(inviteBody));
    assert.equal(inviteBody.delivery, "failed", "fixture must exercise the email-delivery fallback");
    assert.match(inviteBody.inviteUrl, /\/team\/workspace\//);
    await page.getByText(/email could not be delivered/i).waitFor();
    await page.getByRole("button", { name: "Copy invite link", exact: true }).waitFor();
    assert.equal(await page.getByText(/\/team\/workspace\//).count(), 1, "failed delivery must expose the one-time workspace link");
    assert.equal((await db.query(
      "SELECT COUNT(*)::int AS count FROM organization_invites WHERE organization_id = $1 AND LOWER(email) = LOWER($2) AND accepted_at IS NULL",
      [IDS.organization, "workspace-team-audit@example.test"],
    )).rows[0].count, 1);
    await captureAuditScreenshot(page, "06-workspace-invite.png", { redactInviteLink: true });
    console.log("PASS collaborating dashboard, workspace-preserving repeat, role-safe event invite, and failed-email recovery");
  } finally {
    await context.close();
    await plannerContext.close();
    await outsiderContext.close();
    await cleanup(db);
  }
}
