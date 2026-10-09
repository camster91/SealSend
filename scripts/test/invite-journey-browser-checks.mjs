/**
 * Disposable browser checks for the two authenticated invitation journeys.
 *
 * The fixture uses deterministic UUIDs in a reserved local-QA range and
 * fabricated sessions. It never sends an email or SMS and cleans up every
 * row in a finally block. The caller owns the already-running app/server.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const IDS = {
  owner: "00000000-0000-4000-8000-000000000091",
  workspaceMember: "00000000-0000-4000-8000-000000000092",
  eventMember: "00000000-0000-4000-8000-000000000093",
  wrongAccount: "00000000-0000-4000-8000-000000000094",
  organization: "00000000-0000-4000-8000-000000000095",
  event: "00000000-0000-4000-8000-000000000096",
};

const TOKENS = {
  workspace: "w".repeat(43),
  event: "e".repeat(43),
};

const SESSIONS = {
  workspaceMember: "invite-journey-workspace-session",
  eventMember: "invite-journey-event-session",
  wrongAccount: "invite-journey-wrong-session",
};

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

async function assertFixtureIdsAvailable(db) {
  const ids = Object.values(IDS);
  for (const table of ["admin_users", "organizations", "events"]) {
    const result = await db.query(`SELECT id FROM ${table} WHERE id = ANY($1::uuid[])`, [ids]);
    assert.equal(result.rows.length, 0, `invite journey fixture collides with an existing ${table} row`);
  }
}

async function seed(db) {
  await assertFixtureIdsAvailable(db);
  await db.query("BEGIN");
  try {
    await db.query(
      `INSERT INTO admin_users (id, email, name, password)
       VALUES
         ($1, 'invite-journey-owner@example.test', 'Invite Journey Owner', 'disabled-local-qa'),
         ($2, 'workspace-invitee@example.test', 'Workspace Invitee', 'disabled-local-qa'),
         ($3, 'event-invitee@example.test', 'Event Invitee', 'disabled-local-qa'),
         ($4, 'wrong-invite-account@example.test', 'Wrong Invite Account', 'disabled-local-qa')`,
      [IDS.owner, IDS.workspaceMember, IDS.eventMember, IDS.wrongAccount],
    );
    await db.query(
      `INSERT INTO organizations (id, name, slug, plan, is_personal, created_by)
       VALUES ($1, 'Invite Journey Workspace', 'invite-journey-workspace', 'studio', FALSE, $2)`,
      [IDS.organization, IDS.owner],
    );
    await db.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [IDS.organization, IDS.owner],
    );
    await db.query(
      `INSERT INTO events
        (id, user_id, organization_id, title, slug, status, event_date, event_timezone, host_name)
       VALUES ($1, $2, $3, 'Invite Journey Event', 'invite-journey-event', 'published',
               NOW() + INTERVAL '14 days', 'America/Toronto', 'Invite Journey Owner')`,
      [IDS.event, IDS.owner, IDS.organization],
    );
    await db.query(
      `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
       VALUES
         ($1, 'admin', $2, NOW() + INTERVAL '1 day'),
         ($3, 'admin', $4, NOW() + INTERVAL '1 day'),
         ($5, 'admin', $6, NOW() + INTERVAL '1 day')`,
      [
        IDS.workspaceMember,
        SESSIONS.workspaceMember,
        IDS.eventMember,
        SESSIONS.eventMember,
        IDS.wrongAccount,
        SESSIONS.wrongAccount,
      ],
    );
    await db.query(
      `INSERT INTO organization_invites
        (organization_id, email, role, token_hash, token_preview, invited_by, expires_at)
       VALUES ($1, 'workspace-invitee@example.test', 'planner', $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [IDS.organization, hashToken(TOKENS.workspace), TOKENS.workspace.slice(-4), IDS.owner],
    );
    await db.query(
      `INSERT INTO event_member_invites
        (event_id, email, role, token_hash, token_preview, invited_by, expires_at)
       VALUES ($1, 'event-invitee@example.test', 'manager', $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [IDS.event, hashToken(TOKENS.event), TOKENS.event.slice(-4), IDS.owner],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

async function cleanup(db) {
  await db.query("DELETE FROM event_member_invites WHERE event_id = $1", [IDS.event]);
  await db.query("DELETE FROM event_audit_log WHERE event_id = $1", [IDS.event]);
  await db.query("DELETE FROM event_members WHERE event_id = $1", [IDS.event]);
  await db.query("DELETE FROM user_sessions WHERE session_token = ANY($1::text[])", [Object.values(SESSIONS)]);
  await db.query("DELETE FROM events WHERE id = $1", [IDS.event]);
  await db.query("DELETE FROM organization_invites WHERE organization_id = $1", [IDS.organization]);
  await db.query("DELETE FROM organization_members WHERE organization_id = $1", [IDS.organization]);
  await db.query("DELETE FROM organizations WHERE id = $1", [IDS.organization]);
  await db.query("DELETE FROM admin_users WHERE id = ANY($1::uuid[])", [Object.values(IDS).filter((id) => id !== IDS.organization && id !== IDS.event)]);
}

async function sessionContext(browser, origin, sessionToken) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.addCookies([{ name: "sealsend_session", value: sessionToken, url: origin }]);
  return context;
}

async function responseError(response) {
  const body = await response.json().catch(() => ({}));
  return body.error ?? "";
}

/**
 * Run invite acceptance checks inside the caller's already-running QA server.
 * @param {{browser: import('playwright').Browser, origin: string, db: {query: Function}}} input
 */
export async function inviteJourneyBrowserChecks({ browser, origin, db }) {
  const contexts = [];
  let seeded = false;
  try {
    await seed(db);
    seeded = true;

    const wrong = await sessionContext(browser, origin, SESSIONS.wrongAccount);
    contexts.push(wrong);
    const wrongWorkspace = await wrong.request.post(`${origin}/api/workspace-invites/${TOKENS.workspace}/accept`, {
      headers: { Origin: origin },
    });
    assert.equal(wrongWorkspace.status(), 404, await wrongWorkspace.text());
    assert.match(await responseError(wrongWorkspace), /invalid|another account/i);
    assert.equal(
      (await db.query("SELECT accepted_at FROM organization_invites WHERE organization_id = $1", [IDS.organization])).rows[0].accepted_at,
      null,
      "wrong workspace email must leave the invitation pending",
    );
    const wrongEvent = await wrong.request.post(`${origin}/api/team-invites/${TOKENS.event}/accept`, {
      headers: { Origin: origin },
    });
    assert.equal(wrongEvent.status(), 404, await wrongEvent.text());
    assert.match(await responseError(wrongEvent), /invalid|another account/i);
    assert.equal(
      (await db.query("SELECT accepted_at FROM event_member_invites WHERE event_id = $1", [IDS.event])).rows[0].accepted_at,
      null,
      "wrong event email must leave the invitation pending",
    );

    const workspace = await sessionContext(browser, origin, SESSIONS.workspaceMember);
    contexts.push(workspace);
    const workspacePage = await workspace.newPage();
    const workspaceUrl = `${origin}/team/workspace/${TOKENS.workspace}`;
    const workspaceAcceptUrl = `**/api/workspace-invites/${TOKENS.workspace}/accept`;
    let aborted = false;
    const abortFirstWorkspaceAccept = async (route) => {
      if (!aborted && route.request().method() === "POST") {
        aborted = true;
        await route.abort("failed");
        return;
      }
      await route.continue();
    };
    await workspacePage.route(workspaceAcceptUrl, abortFirstWorkspaceAccept);
    await workspacePage.goto(workspaceUrl);
    await workspacePage.getByRole("button", { name: "Accept invitation", exact: true }).click();
    const networkError = workspacePage.getByText("The request could not be completed. Please try again.", { exact: true });
    await networkError.waitFor();
    assert.equal(aborted, true, "the first workspace acceptance request must be aborted by the browser harness");
    const networkAlert = workspacePage.getByRole("alert").filter({ hasText: "The request could not be completed. Please try again." }).first();
    await networkAlert.waitFor();
    assert.equal(
      (await networkAlert.textContent())?.trim(),
      "The request could not be completed. Please try again.",
    );
    const retryButton = workspacePage.getByRole("button", { name: "Try again", exact: true });
    assert.equal(await retryButton.isEnabled(), true, "network failure must leave workspace acceptance retryable");
    await workspacePage.unroute(workspaceAcceptUrl, abortFirstWorkspaceAccept);
    await retryButton.click();
    await workspacePage.waitForURL((url) => url.pathname === "/settings/team");
    const workspaceMembership = (
      await db.query(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [IDS.organization, IDS.workspaceMember],
      )
    ).rows[0];
    assert.equal(workspaceMembership?.role, "planner", "workspace acceptance must preserve the invited role");
    const workspaceInvite = (
      await db.query(
        "SELECT accepted_at, accepted_by FROM organization_invites WHERE organization_id = $1",
        [IDS.organization],
      )
    ).rows[0];
    assert.ok(workspaceInvite?.accepted_at, "workspace acceptance must stamp accepted_at");
    assert.equal(workspaceInvite.accepted_by, IDS.workspaceMember);
    const workspaceReplay = await workspace.request.post(`${origin}/api/workspace-invites/${TOKENS.workspace}/accept`, {
      headers: { Origin: origin },
    });
    assert.equal(workspaceReplay.status(), 404, "workspace invitation must reject replay");

    const event = await sessionContext(browser, origin, SESSIONS.eventMember);
    contexts.push(event);
    const eventPage = await event.newPage();
    const eventUrl = `${origin}/team/invite/${TOKENS.event}`;
    await eventPage.goto(eventUrl);
    await eventPage.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await eventPage.waitForURL((url) => url.pathname === `/events/${IDS.event}`);
    const eventMembership = (
      await db.query("SELECT role FROM event_members WHERE event_id = $1 AND user_id = $2", [IDS.event, IDS.eventMember])
    ).rows[0];
    assert.equal(eventMembership?.role, "manager", "event acceptance must preserve the invited role");
    const eventInvite = (
      await db.query("SELECT accepted_at, accepted_by FROM event_member_invites WHERE event_id = $1", [IDS.event])
    ).rows[0];
    assert.ok(eventInvite?.accepted_at, "event acceptance must stamp accepted_at");
    assert.equal(eventInvite.accepted_by, IDS.eventMember);
    const eventReplay = await event.request.post(`${origin}/api/team-invites/${TOKENS.event}/accept`, {
      headers: { Origin: origin },
    });
    assert.equal(eventReplay.status(), 404, "event invitation must reject replay");

    console.log("PASS workspace and event invite acceptance, wrong-email denial, one-time replay rejection, and retryable network failure");
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    if (seeded) await cleanup(db);
  }
}
