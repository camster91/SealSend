/**
 * Client review journey checks for the native local browser harness.
 *
 * The fixture is disposable and deliberately uses only local .test data. This
 * helper refuses a non-local origin so a share token can never be created on a
 * hosted environment. It does not send email/SMS, call a provider, or retain
 * a client share token after the run.
 */
import assert from "node:assert/strict";

const IDS = {
  owner: "00000000-0000-4000-8000-000000000081",
  organization: "00000000-0000-4000-8000-000000000082",
  event: "00000000-0000-4000-8000-000000000083",
  guest: "00000000-0000-4000-8000-000000000084",
};
const SESSION = "client-journey-owner-session";
const SLUG = "client-journey-event";
const PRIVATE_GUEST_NAME = "Client Journey Private Guest";
const PRIVATE_GUEST_EMAIL = "client-journey-private-guest@example.test";

function assertLocalOrigin(origin) {
  const parsed = new URL(origin);
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname),
    `client journey checks refuse non-local origin ${parsed.hostname}`,
  );
}

async function seed(db) {
  await db.query(
    `INSERT INTO admin_users (id, email, name, password)
     VALUES ($1, 'client-journey-owner@example.test', 'Client Journey Owner', 'fixture-password')`,
    [IDS.owner],
  );
  await db.query(
    `INSERT INTO organizations (id, name, slug, plan, is_personal, created_by)
     VALUES ($1, 'Client Journey Workspace', 'client-journey-workspace', 'studio', FALSE, $2)`,
    [IDS.organization, IDS.owner],
  );
  await db.query(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [IDS.organization, IDS.owner],
  );
  await db.query(
    `INSERT INTO events
       (id, user_id, title, slug, status, event_date, event_timezone,
        location_name, host_name, invitation_headline, invitation_body,
        max_attendees, max_guests_per_rsvp, allow_plus_ones, tier,
        organization_id)
     VALUES ($1, $2, 'Client Journey Event', $3, 'published',
             NOW() + INTERVAL '14 days', 'America/Toronto',
             'Client Journey Hall', 'Client Journey Owner',
             'A private client review', 'Review the invitation and response totals.',
             100, 10, TRUE, 'event_pass', $4)`,
    [IDS.event, IDS.owner, SLUG, IDS.organization],
  );
  await db.query(
    `INSERT INTO guests (id, event_id, name, email, invite_status, rsvp_status)
     VALUES ($1, $2, $3, $4, 'sent', 'attending')`,
    [IDS.guest, IDS.event, PRIVATE_GUEST_NAME, PRIVATE_GUEST_EMAIL],
  );
  await db.query(
    `INSERT INTO rsvp_responses
       (event_id, guest_id, respondent_name, respondent_email, status, headcount, response_data)
     VALUES ($1, $2, $3, $4, 'attending', 1, '{}'::jsonb)`,
    [IDS.event, IDS.guest, PRIVATE_GUEST_NAME, PRIVATE_GUEST_EMAIL],
  );
  await db.query(
    `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
     VALUES ($1, 'admin', $2, NOW() + INTERVAL '1 hour')`,
    [IDS.owner, SESSION],
  );
}

async function cleanup(db) {
  // Scope every delete to this fixture's fixed owner/workspace. Event-owned
  // shares and audit rows cascade with the event; clients cascade with the
  // disposable workspace after the event is gone.
  await db.query("DELETE FROM events WHERE id = $1 AND user_id = $2", [IDS.event, IDS.owner]);
  await db.query("DELETE FROM clients WHERE organization_id = $1", [IDS.organization]);
  await db.query("DELETE FROM user_sessions WHERE session_token = $1", [SESSION]);
  await db.query("DELETE FROM organizations WHERE id = $1 AND created_by = $2", [IDS.organization, IDS.owner]);
  await db.query("DELETE FROM admin_users WHERE id = $1 AND email = 'client-journey-owner@example.test'", [IDS.owner]);
}

/**
 * Run the client CRUD, assignment, review, approval, history, CSV and revoke
 * journey inside the caller's already-running local QA server.
 *
 * @param {{browser: import('playwright').Browser, origin: string, db: {query: Function}, host: import('playwright').BrowserContext}} input
 */
export async function clientJourneyBrowserChecks({ browser, origin, db, host }) {
  assertLocalOrigin(origin);
  let page;
  let anonymousContext;
  let anonymousPage;
  let previousSessionCookie;

  try {
    // The shared harness context usually belongs to another fixture. Borrow
    // it for this journey, then restore its session cookie in finally so the
    // caller's later checks keep their own authenticated identity.
    previousSessionCookie = (await host.cookies(origin)).find((cookie) => cookie.name === "sealsend_session");
    await host.addCookies([{ name: "sealsend_session", value: SESSION, url: origin }]);
    await seed(db);
    page = await host.newPage();

    // Create through the API, then read and update through the real settings
    // UI. The test keeps the event-linked client until history/CSV assertions
    // finish, so the UI exercises a useful client record rather than a stub.
    const created = await host.request.post(`${origin}/api/organizations/${IDS.organization}/clients`, {
      headers: { Origin: origin },
      data: {
        name: "Client Journey Client",
        contactEmail: "client-journey@example.test",
        contactPhone: "",
        notes: "Synthetic local review client",
      },
    });
    assert.equal(created.status(), 201, await created.text());
    const createdBody = await created.json();
    const clientId = createdBody.client?.id;
    assert.match(clientId, /^[0-9a-f-]{36}$/i, "client create should return an id");

    await page.goto(`${origin}/settings/clients`);
    await page.getByText("Client Journey Client", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Edit Client Journey Client", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Client Journey Client Updated");
    await page.getByRole("button", { name: "Save client", exact: true }).click();
    await page.getByText("Client updated.", { exact: true }).waitFor();
    assert.equal(
      (await db.query("SELECT name FROM clients WHERE id = $1", [clientId])).rows[0].name,
      "Client Journey Client Updated",
    );

    // A second record exercises the destructive CRUD edge without unlinking
    // the event that will be used for history and approval assertions.
    const scratch = await host.request.post(`${origin}/api/organizations/${IDS.organization}/clients`, {
      headers: { Origin: origin },
      data: { name: "Client Journey Scratch", contactEmail: "" },
    });
    assert.equal(scratch.status(), 201, await scratch.text());
    await page.reload();
    await page.getByText("Client Journey Scratch", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Remove Client Journey Scratch", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove client", exact: true }).click();
    await page.getByText("Client Journey Scratch removed. Their events were kept.", { exact: true }).waitFor();
    assert.equal(
      (await db.query("SELECT COUNT(*)::int AS count FROM clients WHERE organization_id = $1 AND name = 'Client Journey Scratch'", [IDS.organization])).rows[0].count,
      0,
    );

    // Assign the created client from the event's client panel, exercising the
    // same control a host uses instead of only checking the assignment API.
    await page.goto(`${origin}/events/${IDS.event}`);
    await page.getByRole("heading", { name: "Client", exact: true }).waitFor();
    const clientPicker = page.getByLabel("Client for this event", { exact: true });
    await clientPicker.selectOption(clientId);
    await page.waitForFunction(
      (eventId) => document.querySelector(`select[aria-label="Client for this event"]`)?.value === eventId,
      clientId,
    );
    assert.equal(
      (await db.query("SELECT client_id FROM events WHERE id = $1", [IDS.event])).rows[0].client_id,
      clientId,
      "event assignment should persist the selected client",
    );

    // Wait for the initial panel read before installing the synthetic outage.
    await page.getByRole("button", { name: "Create review link", exact: true }).waitFor();
    let sharePostSucceeded = false;
    let failedFollowupRead = false;
    const clientReadUrl = `**/api/events/${IDS.event}/client`;
    const shareCreateUrl = `**/api/events/${IDS.event}/client-shares`;
    await page.route(clientReadUrl, async (route) => {
      if (sharePostSucceeded && !failedFollowupRead && route.request().method() === "GET") {
        failedFollowupRead = true;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Synthetic client panel outage" }),
        });
        return;
      }
      await route.continue();
    });
    await page.route(shareCreateUrl, async (route) => {
      if (route.request().method() === "POST") sharePostSucceeded = true;
      await route.continue();
    });

    const createLinkResponse = page.waitForResponse((response) =>
      response.request().method() === "POST" && response.url().endsWith(`/api/events/${IDS.event}/client-shares`),
    );
    await page.getByRole("button", { name: "Create review link", exact: true }).click();
    const createdLinkResponse = await createLinkResponse;
    assert.equal(createdLinkResponse.status(), 201, await createdLinkResponse.text());
    const linkBody = await createdLinkResponse.json();
    assert.match(linkBody.url, /\/client\/[A-Za-z0-9_-]+$/, "share creation should return a one-time client URL");
    const returnedShareUrl = new URL(linkBody.url);
    assert.equal(returnedShareUrl.pathname.split("/")[1], "client");
    // The local harness may intentionally omit NEXT_PUBLIC_SITE_URL, in which
    // case the route's production-safe fallback is sealsend.app. Keep the
    // exact returned URL visible in the panel assertion, but resolve the same
    // token path against the already-validated local origin for the browser
    // journey so this helper can never call production.
    const reviewUrl = new URL(returnedShareUrl.pathname, origin).toString();

    // The POST succeeded, but the panel's follow-up read is a synthetic 503.
    // The raw URL must remain visible so a host can copy it and retry the read.
    const linkInput = page.getByLabel("Client review link", { exact: true });
    await linkInput.waitFor();
    assert.equal(await linkInput.inputValue(), returnedShareUrl.toString());
    await page.getByRole("alert").filter({ hasText: "Synthetic client panel outage" }).waitFor();
    assert.equal(failedFollowupRead, true);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Synthetic client panel outage" }).waitFor({ state: "detached" });
    assert.equal(await linkInput.inputValue(), returnedShareUrl.toString(), "retry must preserve the one-time URL");
    await page.unroute(clientReadUrl);
    await page.unroute(shareCreateUrl);

    // Anonymous review must show totals and invitation content without the
    // guest's private name or contact details.
    anonymousContext = await browser.newContext({ ignoreHTTPSErrors: true });
    anonymousPage = await anonymousContext.newPage();
    const reviewResponse = await anonymousPage.goto(reviewUrl);
    assert.equal(reviewResponse?.status(), 200);
    await anonymousPage.getByRole("heading", { name: "Client Journey Event", exact: true }).waitFor();
    const reviewText = await anonymousPage.locator("body").innerText();
    assert.match(reviewText, /Responses so far/);
    assert.match(reviewText, /Guest names and contact details stay private/);
    assert.doesNotMatch(reviewText, new RegExp(PRIVATE_GUEST_NAME));
    assert.doesNotMatch(reviewText, new RegExp(PRIVATE_GUEST_EMAIL));

    await anonymousPage.getByLabel("Your name", { exact: true }).fill("Client Journey Reviewer");
    await anonymousPage.getByRole("button", { name: "Approve invitation", exact: true }).click();
    await anonymousPage.getByRole("status").filter({ hasText: "Approved by Client Journey Reviewer" }).waitFor();
    const approvedRow = (await db.query(
      "SELECT approved_at, approver_name FROM event_client_shares WHERE event_id = $1 AND revoked_at IS NULL",
      [IDS.event],
    )).rows[0];
    assert.ok(approvedRow?.approved_at, "anonymous approval should persist on the share");
    assert.equal(approvedRow.approver_name, "Client Journey Reviewer");

    // The host sees approval on the event panel after its own readback.
    await page.goto(`${origin}/events/${IDS.event}`);
    await page.getByText("Approved by Client Journey Reviewer", { exact: false }).waitFor();

    const history = await host.request.get(`${origin}/api/organizations/${IDS.organization}/clients/${clientId}`, {
      headers: { Origin: origin },
    });
    assert.equal(history.status(), 200, await history.text());
    const historyBody = await history.json();
    assert.equal(historyBody.events.length, 1);
    assert.equal(historyBody.events[0].title, "Client Journey Event");
    assert.equal(historyBody.events[0].approverName, "Client Journey Reviewer");

    const csv = await host.request.get(`${origin}/api/organizations/${IDS.organization}/clients/${clientId}?format=csv`, {
      headers: { Origin: origin },
    });
    assert.equal(csv.status(), 200, await csv.text());
    const csvBody = await csv.text();
    assert.match(csvBody, /Client Journey Event/);
    assert.match(csvBody, /Client Journey Reviewer/);
    assert.doesNotMatch(csvBody, new RegExp(PRIVATE_GUEST_NAME));
    assert.doesNotMatch(csvBody, new RegExp(PRIVATE_GUEST_EMAIL));

    // Approval is one-time, even before the host revokes the share.
    const token = new URL(reviewUrl).pathname.split("/").pop();
    assert.ok(token);
    const replay = await anonymousContext.request.post(`${origin}/api/client-shares/${token}/approve`, {
      headers: { Origin: origin },
      data: { name: "Replay Attempt" },
    });
    assert.equal(replay.status(), 404, await replay.text());

    // Revoke through the event UI, then replaying the captured URL must fail.
    await page.getByRole("button", { name: /Revoke review link ending/ }).click();
    await page.getByRole("button", { name: /Revoke review link ending/ }).waitFor({ state: "detached" });
    const revoked = await anonymousContext.request.get(reviewUrl);
    assert.equal(revoked.status(), 404, "revoked client URL must not be replayable");
    const replayPage = await anonymousPage.goto(reviewUrl);
    assert.equal(replayPage?.status(), 404, "revoked client URL should render the not-found page");

    const expiringShare = await host.request.post(`${origin}/api/events/${IDS.event}/client-shares`, { headers: { Origin: origin } });
    assert.equal(expiringShare.status(), 201, await expiringShare.text());
    const expiredPath = new URL((await expiringShare.json()).url).pathname;
    const expiredUrl = new URL(expiredPath, origin).href;
    await db.query("UPDATE event_client_shares SET expires_at = NOW() - INTERVAL '1 minute' WHERE event_id = $1 AND revoked_at IS NULL", [IDS.event]);
    assert.equal((await anonymousContext.request.get(expiredUrl)).status(), 404, "expired review must not expose event content");
    const expiredApproval = await anonymousContext.request.post(`${origin}/api/client-shares/${expiredPath.split('/').pop()}/approve`, { headers: { Origin: origin }, data: { name: "Expired Attempt" } });
    assert.equal(expiredApproval.status(), 404, "expired review must not accept approval");

    console.log("PASS client CRUD UI/API, event assignment, resilient one-time URL recovery, private review totals, approval readback, history CSV, and revoke/replay protection");
  } finally {
    await anonymousContext?.close();
    await page?.close();
    try {
      await cleanup(db);
    } finally {
      if (previousSessionCookie) await host.addCookies([previousSessionCookie]);
      else await host.clearCookies({ name: "sealsend_session" });
    }
  }
}
