/**
 * Disposable browser checks for the organizer workspace journeys.
 *
 * The caller owns the already-running local QA server and browser. This
 * helper owns only its reserved fixture rows and, when the caller has
 * explicitly enabled WEBHOOK_ALLOW_PRIVATE_TARGETS, a loopback receiver.
 * It never changes that flag, sends a provider message, or talks to a
 * production origin.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";

const IDS = {
  planner: "00000000-0000-4000-8000-000000000101",
  owner: "00000000-0000-4000-8000-000000000102",
  outsider: "00000000-0000-4000-8000-000000000103",
  organization: "00000000-0000-4000-8000-000000000104",
  event: "00000000-0000-4000-8000-000000000105",
  guest: "00000000-0000-4000-8000-000000000106",
};

const SESSIONS = {
  owner: "organizer-journey-owner-session",
  planner: "organizer-journey-planner-session",
  outsider: "organizer-journey-outsider-session",
};

const OWNER_EMAIL = "organizer-journey-owner@example.test";
const PLANNER_EMAIL = "organizer-journey-planner@example.test";
const OUTSIDER_EMAIL = "organizer-journey-outsider@example.test";
const EVENT_SLUG = "organizer-journey-event";

function assertLocalOrigin(origin) {
  const url = new URL(origin);
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname),
    `organizer journey refuses a non-local origin: ${origin}`,
  );
}

async function assertFixtureIdsAvailable(db) {
  const ids = Object.values(IDS);
  for (const table of ["admin_users", "organizations", "events", "guests"]) {
    const result = await db.query(`SELECT id FROM ${table} WHERE id = ANY($1::uuid[])`, [ids]);
    assert.equal(result.rows.length, 0, `organizer journey fixture collides with ${table}`);
  }
}

async function seed(db) {
  await assertFixtureIdsAvailable(db);
  await db.query("BEGIN");
  try {
    await db.query(
      `INSERT INTO admin_users (id, email, name, password)
       VALUES
         ($1, $2, 'Organizer Journey Owner', 'disabled-local-qa'),
         ($3, $4, 'Organizer Journey Planner', 'disabled-local-qa'),
         ($5, $6, 'Organizer Journey Outsider', 'disabled-local-qa')`,
      [IDS.owner, OWNER_EMAIL, IDS.planner, PLANNER_EMAIL, IDS.outsider, OUTSIDER_EMAIL],
    );
    await db.query(
      `INSERT INTO organizations (id, name, slug, plan, is_personal, created_by)
       VALUES ($1, 'Organizer Journey Workspace', 'organizer-journey-workspace', 'studio', FALSE, $2)`,
      [IDS.organization, IDS.owner],
    );
    await db.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner'), ($1, $3, 'planner')`,
      [IDS.organization, IDS.owner, IDS.planner],
    );
    await db.query(
      `INSERT INTO events
        (id, user_id, organization_id, title, slug, status, event_date, event_timezone,
         location_name, host_name, invitation_headline, invitation_body, customization)
       VALUES ($1, $2, $3, 'Organizer Journey Event', $4, 'published',
               NOW() + INTERVAL '14 days', 'America/Toronto', 'QA Hall',
               'Organizer Journey Owner', 'You are invited', 'A local synthetic RSVP check.', '{}')`,
      [IDS.event, IDS.owner, IDS.organization, EVENT_SLUG],
    );
    await db.query(
      `INSERT INTO rsvp_fields
        (event_id, field_name, field_type, field_label, is_required, is_enabled, sort_order, options, placeholder)
       VALUES
        ($1, 'respondent_name', 'text', 'Full Name', TRUE, TRUE, 0, NULL, 'Enter your full name'),
        ($1, 'email', 'email', 'Email Address', TRUE, TRUE, 1, NULL, 'your@email.com'),
        ($1, 'attending', 'attendance', 'Will you be attending?', TRUE, TRUE, 2, '["attending","not_attending","maybe"]', NULL),
        ($1, 'headcount', 'number', 'Number of Guests', FALSE, TRUE, 3, NULL, 'Including yourself')`,
      [IDS.event],
    );
    await db.query(
      `INSERT INTO guests (id, event_id, name, email, invite_token, invite_status, rsvp_status)
       VALUES ($1, $2, 'Organizer Journey Guest', 'organizer-journey-guest@example.test', $3, 'pending', 'pending')`,
      [IDS.guest, IDS.event, "organizer-journey-guest-token"],
    );
    await db.query(
      `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
       VALUES
         ($1, 'admin', $2, NOW() + INTERVAL '1 day'),
         ($3, 'admin', $4, NOW() + INTERVAL '1 day'),
         ($5, 'admin', $6, NOW() + INTERVAL '1 day')`,
      [IDS.owner, SESSIONS.owner, IDS.planner, SESSIONS.planner, IDS.outsider, SESSIONS.outsider],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

async function cleanup(db) {
  // Event rows cascade their RSVP/field records. Webhook rows are removed
  // explicitly so this remains safe on older local schemas too.
  await db.query(
    "DELETE FROM webhook_deliveries WHERE webhook_id IN (SELECT id FROM organization_webhooks WHERE organization_id = $1)",
    [IDS.organization],
  );
  await db.query("DELETE FROM organization_webhooks WHERE organization_id = $1", [IDS.organization]);
  await db.query("DELETE FROM event_audit_log WHERE event_id = $1", [IDS.event]);
  await db.query("DELETE FROM activation_events WHERE user_id = ANY($1::uuid[])", [[IDS.owner, IDS.planner, IDS.outsider]]);
  await db.query("DELETE FROM user_sessions WHERE session_token = ANY($1::text[])", [Object.values(SESSIONS)]);
  await db.query("DELETE FROM events WHERE id = $1", [IDS.event]);
  await db.query("DELETE FROM organization_members WHERE organization_id = $1", [IDS.organization]);
  // The settings pages create a personal workspace on first load. It is
  // fixture-owned, so remove it together with the explicit team workspace.
  await db.query("DELETE FROM organizations WHERE created_by = ANY($1::uuid[])", [[IDS.owner, IDS.planner, IDS.outsider]]);
  await db.query("DELETE FROM admin_users WHERE id = ANY($1::uuid[])", [[IDS.owner, IDS.planner, IDS.outsider]]);
}

async function sessionContext(browser, origin, sessionToken) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, permissions: ["clipboard-read", "clipboard-write"] });
  await context.addCookies([{ name: "sealsend_session", value: sessionToken, url: origin }]);
  return context;
}

async function selectWorkspace(page) {
  const picker = page.getByLabel("Workspace");
  await picker.waitFor();
  await picker.locator(`option[value="${IDS.organization}"]`).waitFor({ state: "attached" });
  await picker.selectOption(IDS.organization);
  assert.equal(await picker.inputValue(), IDS.organization);
}

async function startLoopbackReceiverIfAuthorized() {
  // The runtime flag must have existed before the app started. This helper
  // deliberately does not set or unset it; production therefore cannot be
  // made to accept a private target by a test helper.
  if (process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS !== "true") return null;

  const requests = [];
  let requestCount = 0;
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      requestCount += 1;
      // Force one retry, then accept the same signed delivery.
      response.statusCode = requestCount === 1 ? 503 : 204;
      response.end();
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object", "loopback receiver must expose a port");
  return {
    url: `http://127.0.0.1:${address.port}/organizer-journey-hook`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * Run organizer brand-kit, public RSVP, access-control and webhook checks in
 * the caller's already-running local QA server.
 *
 * @param {{browser: import('playwright').Browser, origin: string, db: {query: Function}}} input
 */
export async function organizerJourneyBrowserChecks({ browser, origin, db }) {
  assertLocalOrigin(origin);
  const contexts = [];
  let seeded = false;
  let receiver;
  let webhookId;
  let webhookSecret;
  try {
    await seed(db);
    seeded = true;
    receiver = await startLoopbackReceiverIfAuthorized();
    const webhookUrl = receiver?.url ?? "https://hooks.example.test/organizer-journey";

    const owner = await sessionContext(browser, origin, SESSIONS.owner);
    contexts.push(owner);
    const ownerPage = await owner.newPage();

    // Brand kit: create and persist the workspace default brand through the UI.
    await ownerPage.goto(`${origin}/settings/brand`);
    await ownerPage.getByRole("heading", { level: 1, name: "Brand kit", exact: true }).waitFor();
    await selectWorkspace(ownerPage);
    await ownerPage.getByLabel("Brand name", { exact: true }).waitFor();
    await ownerPage.getByLabel("Brand name", { exact: true }).fill("Organizer Journey Brand");
    await ownerPage.getByLabel("Logo URL", { exact: true }).fill("https://assets.example.test/organizer-journey-logo.svg");
    await ownerPage.getByLabel("Primary colour", { exact: true }).fill("#244E3B");
    await ownerPage.getByLabel("Background colour", { exact: true }).fill("#FFF8EE");
    await ownerPage.getByLabel("Email sender name", { exact: true }).fill("Organizer Journey");
    await ownerPage.getByLabel("Reply-to email", { exact: true }).fill("hello@organizer-journey.example.test");
    await ownerPage.getByLabel("Text message signature", { exact: true }).fill("Organizer Journey");
    await ownerPage.getByRole("button", { name: "Save brand", exact: true }).click();
    await ownerPage.getByRole("status").filter({ hasText: "Brand saved" }).waitFor();
    const savedBrand = (
      await db.query("SELECT name, primary_color, background_color, logo_url FROM brands WHERE organization_id = $1 AND is_default", [IDS.organization])
    ).rows[0];
    assert.deepEqual(savedBrand, {
      name: "Organizer Journey Brand",
      primary_color: "#244E3B",
      background_color: "#FFF8EE",
      logo_url: "https://assets.example.test/organizer-journey-logo.svg",
    });

    // Invalid input is visible and leaves the saved value untouched.
    await ownerPage.getByLabel("Primary colour", { exact: true }).fill("not-a-colour");
    await ownerPage.getByRole("button", { name: "Save brand", exact: true }).click();
    await ownerPage.getByRole("alert").filter({ hasText: "Primary colour must be a 6-digit hex colour" }).waitFor();
    assert.equal(
      (await db.query("SELECT primary_color FROM brands WHERE organization_id = $1 AND is_default", [IDS.organization])).rows[0].primary_color,
      "#244E3B",
      "client-side invalid colour must not overwrite the saved brand",
    );
    await ownerPage.getByRole("button", { name: "Remove brand", exact: true }).click();
    await ownerPage.getByRole("status").filter({ hasText: "Brand removed" }).waitFor();
    assert.equal(
      (await db.query("SELECT COUNT(*)::int AS count FROM brands WHERE organization_id = $1 AND is_default", [IDS.organization])).rows[0].count,
      0,
      "removing a brand must delete the workspace default",
    );
    await ownerPage.getByLabel("Primary colour", { exact: true }).fill("#244E3B");

    // Workspace role denial: planner and unrelated outsider cannot mutate or
    // even enumerate the owner's brand or integration endpoints.
    const planner = await sessionContext(browser, origin, SESSIONS.planner);
    contexts.push(planner);
    const outsider = await sessionContext(browser, origin, SESSIONS.outsider);
    contexts.push(outsider);
    const plannerBrandWrite = await planner.request.put(`${origin}/api/organizations/${IDS.organization}/brand`, {
      headers: { Origin: origin },
      data: { name: "Planner must not write", primaryColor: "#112233" },
    });
    assert.equal(plannerBrandWrite.status(), 404, await plannerBrandWrite.text());
    const outsiderBrandRead = await outsider.request.get(`${origin}/api/organizations/${IDS.organization}/brand`);
    assert.equal(outsiderBrandRead.status(), 404, await outsiderBrandRead.text());

    // Register the webhook through the UI and capture its one-time secret.
    await ownerPage.goto(`${origin}/settings/integrations`);
    await ownerPage.getByRole("heading", { level: 1, name: "Integrations", exact: true }).waitFor();
    await ownerPage.getByRole("heading", { level: 3, name: "Webhooks", exact: true }).waitFor();
    await selectWorkspace(ownerPage);
    await ownerPage.getByLabel("Endpoint URL", { exact: true }).waitFor();
    await ownerPage.getByLabel("Endpoint URL", { exact: true }).fill(webhookUrl);
    await ownerPage.getByRole("button", { name: "Add webhook", exact: true }).click();
    await ownerPage.getByText("Webhook added.", { exact: true }).waitFor();
    const secretInput = ownerPage.getByLabel("Webhook signing secret", { exact: true });
    await secretInput.waitFor();
    webhookSecret = await secretInput.inputValue();
    assert.match(webhookSecret, /^whsec_[A-Za-z0-9_-]{43}$/);
    webhookId = (
      await db.query("SELECT id, secret, active FROM organization_webhooks WHERE organization_id = $1", [IDS.organization])
    ).rows[0].id;
    assert.equal(
      (await db.query("SELECT secret FROM organization_webhooks WHERE id = $1", [webhookId])).rows[0].secret,
      webhookSecret,
      "the UI must reveal the server-generated secret exactly once",
    );

    // A reload keeps only the redacted preview; the full secret is not fetched again.
    await ownerPage.reload();
    await ownerPage.getByRole("heading", { level: 3, name: "Webhooks", exact: true }).waitFor();
    await selectWorkspace(ownerPage);
    assert.equal(await ownerPage.getByLabel("Webhook signing secret", { exact: true }).count(), 0, "secret must not be shown again after reload");
    const redactedPreview = ownerPage.getByText(/secret whsec_…/);
    await redactedPreview.waitFor();
    const redacted = await redactedPreview.count();
    assert.equal(redacted, 1, "only a redacted secret preview should remain visible");
    const listed = await ownerPage.request.get(`${origin}/api/organizations/${IDS.organization}/webhooks`);
    assert.equal(listed.status(), 200, await listed.text());
    const listedBody = await listed.json();
    assert.doesNotMatch(JSON.stringify(listedBody), new RegExp(webhookSecret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "GET must never return the full webhook secret");

    const plannerWebhookWrite = await planner.request.post(`${origin}/api/organizations/${IDS.organization}/webhooks`, {
      headers: { Origin: origin },
      data: { url: "https://hooks.example.test/planner-denied", events: ["rsvp.submitted"] },
    });
    assert.equal(plannerWebhookWrite.status(), 404, await plannerWebhookWrite.text());
    const outsiderWebhookRead = await outsider.request.get(`${origin}/api/organizations/${IDS.organization}/webhooks`);
    assert.equal(outsiderWebhookRead.status(), 404, await outsiderWebhookRead.text());

    // A public visitor applies to the published event. This is an actual
    // browser journey; the response also queues the subscribed webhook.
    const publicContext = await browser.newContext({ ignoreHTTPSErrors: true });
    contexts.push(publicContext);
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`${origin}/e/${EVENT_SLUG}`);
    await publicPage.getByRole("form", { name: "RSVP" }).waitFor();
    await publicPage.getByRole("button", { name: "Submit RSVP", exact: true }).waitFor();
    await publicPage.getByLabel("Your Name *", { exact: true }).fill("Organizer Journey Guest");
    await publicPage.getByLabel("Email Address *", { exact: true }).fill("organizer-journey-guest@example.test");
    await publicPage.getByRole("button", { name: "Attending", exact: true }).click();
    await publicPage.getByLabel("Number of Guests", { exact: true }).fill("1");
    await publicPage.getByRole("button", { name: "Submit RSVP", exact: true }).click();
    await publicPage.getByText("Your response has been recorded.", { exact: true }).waitFor();
    const response = (
      await db.query("SELECT status, respondent_name, respondent_email FROM rsvp_responses WHERE event_id = $1", [IDS.event])
    ).rows[0];
    assert.deepEqual(response, {
      status: "attending",
      respondent_name: "Organizer Journey Guest",
      respondent_email: "organizer-journey-guest@example.test",
    });

    // Calendar export and all three public links stay tied to the published
    // event record. Only the local calendar endpoint is requested; the
    // Google and Outlook links are inspected without opening external sites.
    const calendar = await publicPage.request.get(`${origin}/api/calendar/${EVENT_SLUG}`);
    assert.equal(calendar.status(), 200, await calendar.text());
    assert.match(calendar.headers()["content-type"] ?? "", /text\/calendar/);
    assert.match(calendar.headers()["content-disposition"] ?? "", new RegExp(`${EVENT_SLUG}\\.ics`));
    const ics = await calendar.text();
    assert.match(ics, /BEGIN:VCALENDAR/);
    assert.match(ics, new RegExp(`UID:${IDS.event}@sealsend\\.app`));
    assert.match(ics, /DTSTART:/);
    assert.match(ics, /END:VCALENDAR/);
    await publicPage.getByRole("link", { name: "Google", exact: true }).waitFor();
    await publicPage.getByRole("link", { name: "Google", exact: true }).getAttribute("href").then((href) => assert.match(href ?? "", /calendar\.google\.com/));
    assert.equal(
      await publicPage.getByRole("link", { name: "Apple / iCal", exact: true }).getAttribute("href"),
      `/api/calendar/${EVENT_SLUG}`,
    );
    await publicPage.getByRole("link", { name: "Outlook", exact: true }).getAttribute("href").then((href) => assert.match(href ?? "", /outlook\.live\.com/));

    // Future announcements require a reviewed audience proof but remain
    // queued. This deliberately never calls the send cron or a provider.
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const audience = { rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: false };
    const announcementDraft = {
      subject: "Organizer journey future update",
      message: "This queued-only local QA announcement must never dispatch.",
      audience,
      channels: ["email"],
      sendAt: scheduledAt,
    };
    const preview = await owner.request.post(`${origin}/api/events/${IDS.event}/announcements/audience`, {
      headers: { Origin: origin },
      data: announcementDraft,
    });
    assert.equal(preview.status(), 200, await preview.text());
    const previewBody = await preview.json();
    assert.equal(previewBody.count, 1, "the own synthetic guest should resolve in the future announcement audience");
    assert.equal(previewBody.emailCount, 1);
    assert.equal(typeof previewBody.approvalProof, "string");
    const createAnnouncement = await owner.request.post(`${origin}/api/events/${IDS.event}/announcements`, {
      headers: { Origin: origin },
      data: {
        subject: announcementDraft.subject,
        message: announcementDraft.message,
        audience: announcementDraft.audience,
        channels: announcementDraft.channels,
        scheduledAt,
        approved: true,
        contactConfirmed: true,
        approvalProof: previewBody.approvalProof,
      },
    });
    assert.equal(createAnnouncement.status(), 201, await createAnnouncement.text());
    const createdAnnouncement = await createAnnouncement.json();
    assert.equal(createdAnnouncement.status, "queued");
    assert.equal(createdAnnouncement.dispatch, null);
    assert.equal(
      (await db.query("SELECT COUNT(*)::int AS count FROM announcement_deliveries WHERE announcement_id = $1", [createdAnnouncement.id])).rows[0].count,
      0,
      "future scheduling must not create provider delivery rows",
    );
    const listedAnnouncements = await owner.request.get(`${origin}/api/events/${IDS.event}/announcements`);
    assert.equal(listedAnnouncements.status(), 200, await listedAnnouncements.text());
    assert.equal((await listedAnnouncements.json()).find((item) => item.id === createdAnnouncement.id)?.status, "queued");
    const cancelAnnouncement = await owner.request.delete(`${origin}/api/events/${IDS.event}/announcements/${createdAnnouncement.id}`, {
      headers: { Origin: origin },
    });
    assert.equal(cancelAnnouncement.status(), 200, await cancelAnnouncement.text());
    assert.equal((await cancelAnnouncement.json()).status, "cancelled");
    const cancelledList = await owner.request.get(`${origin}/api/events/${IDS.event}/announcements`);
    assert.equal((await cancelledList.json()).find((item) => item.id === createdAnnouncement.id)?.status, "cancelled");

    const queued = (
      await db.query(
        `SELECT d.id, d.status, d.attempts, d.next_attempt_at
           FROM webhook_deliveries d JOIN organization_webhooks w ON w.id = d.webhook_id
          WHERE w.id = $1 ORDER BY d.created_at DESC LIMIT 1`,
        [webhookId],
      )
    ).rows[0];
    assert.equal(queued.status, "pending", "public RSVP must queue a pending delivery");
    assert.equal(queued.attempts, 0);

    // Pause blocks the queued delivery, then resume re-enables it.
    const webhookRow = ownerPage.getByRole("listitem").filter({ hasText: webhookUrl });
    await webhookRow.getByRole("button", { name: "Pause", exact: true }).click();
    await ownerPage.getByText("Webhook paused.", { exact: true }).waitFor();
    await webhookRow.getByRole("button", { name: "Resume", exact: true }).waitFor();
    assert.equal((await db.query("SELECT active FROM organization_webhooks WHERE id = $1", [webhookId])).rows[0].active, false);
    const plannerPause = await planner.request.patch(`${origin}/api/organizations/${IDS.organization}/webhooks/${webhookId}`, {
      headers: { Origin: origin },
      data: { active: false },
    });
    assert.equal(plannerPause.status(), 404, await plannerPause.text());

    await webhookRow.getByRole("button", { name: "Resume", exact: true }).click();
    await ownerPage.getByText("Webhook resumed.", { exact: true }).waitFor();
    await webhookRow.getByRole("button", { name: "Pause", exact: true }).waitFor();
    assert.equal((await db.query("SELECT active FROM organization_webhooks WHERE id = $1", [webhookId])).rows[0].active, true);

    const outsiderDelete = await outsider.request.delete(`${origin}/api/organizations/${IDS.organization}/webhooks/${webhookId}`, {
      headers: { Origin: origin },
    });
    assert.equal(outsiderDelete.status(), 404, await outsiderDelete.text());

    let deliveryEvidence = "queued-only (private receiver disabled; no delivery attempted)";
    if (receiver) {
      const { deliverDueWebhooks, verifyWebhookSignature } = await import("../../src/lib/webhooks.ts");
      // Make the fixture due immediately; production cron timing is not
      // changed and no external scheduler is contacted.
      await db.query("UPDATE webhook_deliveries SET next_attempt_at = NOW() WHERE webhook_id = $1", [webhookId]);
      const first = await deliverDueWebhooks(10);
      assert.deepEqual(first, { attempted: 1, delivered: 0, failed: 0 }, "first receiver response should schedule a retry");
      const afterFirst = (await db.query("SELECT status, attempts, last_status_code FROM webhook_deliveries WHERE webhook_id = $1", [webhookId])).rows[0];
      assert.deepEqual(afterFirst, { status: "pending", attempts: 1, last_status_code: 503 });
      await db.query("UPDATE webhook_deliveries SET next_attempt_at = NOW() WHERE webhook_id = $1", [webhookId]);
      const second = await deliverDueWebhooks(10);
      assert.deepEqual(second, { attempted: 1, delivered: 1, failed: 0 }, "retry should deliver after the receiver recovers");
      const afterSecond = (await db.query("SELECT status, attempts, last_status_code FROM webhook_deliveries WHERE webhook_id = $1", [webhookId])).rows[0];
      assert.deepEqual(afterSecond, { status: "delivered", attempts: 2, last_status_code: 204 });
      assert.equal(receiver.requests.length, 2, "receiver should observe the initial attempt and one retry");
      const signed = receiver.requests[1];
      assert.equal(signed.method, "POST");
      assert.equal(signed.headers["sealsend-signature"] ? verifyWebhookSignature(webhookSecret, signed.body, signed.headers["sealsend-signature"]) : false, true, "retry must carry a valid HMAC signature");
      deliveryEvidence = "signed local delivery with one 503 retry followed by HTTP 204";
    }

    // Owner UI deletion removes the endpoint and its delivery history.
    await webhookRow.getByRole("button", { name: `Delete webhook ${webhookUrl}`, exact: true }).click();
    await ownerPage.getByRole("alertdialog").getByRole("button", { name: "Delete webhook", exact: true }).click();
    await ownerPage.getByText("Webhook deleted.", { exact: true }).waitFor();
    await webhookRow.waitFor({ state: "detached" });
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM organization_webhooks WHERE id = $1", [webhookId])).rows[0].count, 0);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM webhook_deliveries WHERE webhook_id = $1", [webhookId])).rows[0].count, 0);

    console.log(`PASS organizer brand kit create/validation/removal, public RSVP application, role denial, one-time webhook secret, pause/resume/delete authorization, and ${deliveryEvidence}`);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    if (receiver) await receiver.close();
    if (seeded) await cleanup(db);
  }
}
