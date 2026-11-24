import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";

process.env.SQLITE_PATH = ":memory:";
process.env.SESSION_SECRET ??= "test-session-secret-for-local-unit-tests";
process.env.NEXT_PUBLIC_SITE_URL = "https://sealsend.test";
delete process.env.APP_URL;

const { exec, query, queryOne } = await import("../src/lib/db/client");
const { withMobileContext } = await import("../src/lib/auth/mobile-context");
await exec(readFileSync("src/lib/db/schema.sql", "utf8"));

const DAY = 86_400_000;
async function seedHost(email: string) {
  return (await queryOne<{ id: string }>("INSERT INTO admin_users (email, password) VALUES ($1, 'x') RETURNING id", [email]))!.id;
}
async function seedEvent(userId: string, slug: string, body: string | null, date: Date, headline: string | null = null) {
  return (await queryOne<{ id: string }>(
    `INSERT INTO events (user_id, title, slug, status, event_date, event_timezone, location_name, host_name, invitation_body, invitation_headline)
     VALUES ($1, 'Party', $2, 'published', $3, 'America/Toronto', 'Hall', 'Maya', $4, $5) RETURNING id`,
    [userId, slug, date, body, headline],
  ))!.id;
}
const asHost = <T>(id: string, action: () => Promise<T>) =>
  withMobileContext({ user: { id, email: "h@example.test", phone: null, role: "admin" as const }, sessionToken: "t" }, action);
const json = (method: string, body: unknown) =>
  new NextRequest("https://sealsend.test/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function defaultsFor(date: Date) {
  const { defaultInvitationCopy } = await import("../src/lib/invitation-defaults");
  return defaultInvitationCopy({ title: "Party", host_name: "Maya", event_date: date, event_timezone: "America/Toronto", location_name: "Hall" });
}

test("moving an event refreshes the invitation sentence SealSend wrote", async () => {
  const { PATCH } = await import("../src/app/api/events/[eventId]/route");
  const host = await seedHost("move@example.test");
  const before = new Date(Date.now() + 30 * DAY), after = new Date(Date.now() + 31 * DAY);
  const written = await defaultsFor(before);
  const id = await seedEvent(host, "move", written.body, before, written.headline);
  const response = await asHost(host, () => PATCH(json("PATCH", { event_date: after.toISOString() }), { params: Promise.resolve({ eventId: id }) }));
  assert.equal(response.status, 200);
  const row = await queryOne<{ invitation_body: string }>("SELECT invitation_body FROM events WHERE id = $1", [id]);
  assert.equal(row!.invitation_body, (await defaultsFor(after)).body);
});

test("moving an event never changes a sentence the host wrote", async () => {
  const { PATCH } = await import("../src/app/api/events/[eventId]/route");
  const host = await seedHost("own@example.test");
  const id = await seedEvent(host, "own", "Come hungry at 2!", new Date(Date.now() + 30 * DAY));
  await asHost(host, () => PATCH(json("PATCH", { event_date: new Date(Date.now() + 31 * DAY).toISOString() }), { params: Promise.resolve({ eventId: id }) }));
  const row = await queryOne<{ invitation_body: string }>("SELECT invitation_body FROM events WHERE id = $1", [id]);
  assert.equal(row!.invitation_body, "Come hungry at 2!");
});

test("repeating an event does not copy the old date or title in generated wording", async () => {
  const { POST } = await import("../src/app/api/events/[eventId]/clone/route");
  const host = await seedHost("repeat@example.test");
  const date = new Date(Date.now() + 30 * DAY);
  const written = await defaultsFor(date);
  const id = await seedEvent(host, "repeat", written.body, date, written.headline);
  const response = await asHost(host, () => POST(json("POST", {
    title: "Next party", eventDate: new Date(Date.now() + 60 * DAY).toISOString(), eventEndDate: null, rsvpDeadline: null, includeGuests: false, archiveSource: true,
  }), { params: Promise.resolve({ eventId: id }) }));
  assert.ok(response.status < 300, `clone returned ${response.status}`);
  const copy = await queryOne<{ invitation_body: string | null; invitation_headline: string | null }>(
    "SELECT invitation_body, invitation_headline FROM events WHERE repeated_from_event_id = $1", [id]);
  assert.ok(!copy!.invitation_body, "generated body is dropped so it is rewritten on publish");
  assert.ok(!copy!.invitation_headline, "generated headline is dropped so it is rewritten on publish");
});

test("a personal invite link signs the guest in and opens their invitation", async () => {
  const { GET } = await import("../src/app/invite/accept/route");
  const host = await seedHost("invite@example.test");
  const id = await seedEvent(host, "invite", null, new Date(Date.now() + 30 * DAY));
  const guest = (await queryOne<{ id: string }>("INSERT INTO guests (event_id, name, email, invite_token) VALUES ($1, 'Ana', 'ana@example.test', 'tok-ana') RETURNING id", [id]))!.id;
  const response = await GET(new NextRequest("https://sealsend.test/invite/accept?token=tok-ana&event=invite"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://sealsend.test/e/invite?t=tok-ana");
  const session = await queryOne<{ session_token: string }>("SELECT session_token FROM user_sessions WHERE user_id = $1 AND user_role = 'guest'", [guest]);
  assert.equal(response.cookies.get("sealsend_session")?.value, session!.session_token);
  assert.equal(response.cookies.get("sealsend_session")?.httpOnly, true);
  assert.equal((await queryOne<{ invite_status: string }>("SELECT invite_status FROM guests WHERE id = $1", [guest]))!.invite_status, "accepted");
});

test("a wrong invite link creates no session", async () => {
  const { GET } = await import("../src/app/invite/accept/route");
  await query("DELETE FROM user_sessions");
  for (const search of ["token=nope&event=invite", "token=tok-ana&event=other", "token=tok-ana", ""]) {
    const response = await GET(new NextRequest(`https://sealsend.test/invite/accept?${search}`));
    assert.equal(response.headers.get("location"), "https://sealsend.test/login?error=invalid_invite");
    assert.equal(response.cookies.get("sealsend_session"), undefined);
  }
  assert.equal((await query("SELECT id FROM user_sessions")).length, 0);
});

test("dietary notes keep the guest's full words", async () => {
  const { summarizeDietary } = await import("../src/lib/dietary-summary");
  const reply = (status: string, dietary: unknown) => ({ status, response_data: { dietary_restrictions: dietary } });
  assert.deepEqual(summarizeDietary([
    reply("attending", "Vegetarian, nut allergy"), reply("attending", "vegetarian"), reply("attending", " Vegetarian "),
    reply("attending", "Peanut allergy, no shellfish"), reply("not_attending", "Vegan"), reply("attending", ""), reply("attending", 3), { status: "attending", response_data: null },
  ]), [
    { note: "vegetarian", count: 2 },
    { note: "Peanut allergy, no shellfish", count: 1 },
    { note: "Vegetarian, nut allergy", count: 1 },
  ]);
});

test("a failed update is never shown as a success", async () => {
  const { announcementOutcome } = await import("../src/lib/announcement-outcome");
  assert.deepEqual(announcementOutcome("failed", 0), { ok: false, title: "Your update wasn't sent", detail: "No guests received it. Please try again." });
  assert.equal(announcementOutcome("sent", 0).ok, false);
  assert.equal(announcementOutcome("sent", 1).detail, "Sent to 1 guest.");
  assert.equal(announcementOutcome("sent", 4).ok, true);
  assert.equal(announcementOutcome("queued", 0).title, "Update scheduled");
  assert.equal(announcementOutcome("partially_failed", 3).ok, false);
  assert.match(announcementOutcome("partially_failed", 3).detail, /3 guests/);
});

test("taking a live event offline needs a deliberate tick", async () => {
  const { canSubmitRepeat } = await import("../src/lib/repeat-event-choice");
  assert.equal(canSubmitRepeat({ mustArchiveSource: true, archiveSource: false }), false);
  assert.equal(canSubmitRepeat({ mustArchiveSource: true, archiveSource: true }), true);
  assert.equal(canSubmitRepeat({ mustArchiveSource: false, archiveSource: false }), true);
  const dialog = readFileSync("src/components/dashboard/CloneEventButton.tsx", "utf8");
  assert.match(dialog, /setArchiveSource\] = useState\(false\)/);
  assert.match(dialog, /invitation link will stop working/);
  assert.doesNotMatch(dialog, /disabled=\{mustArchiveSource\}/);
});

test("phone hosts can sign out from settings, and empty invite cells show a dash", () => {
  assert.match(readFileSync("src/app/(dashboard)/settings/page.tsx", "utf8"), /<SignOutButton/);
  assert.doesNotMatch(readFileSync("src/components/guests/GuestTable.tsx", "utf8"), />\\u2014</);
});
