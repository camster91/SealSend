import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";

import { isValidRelativePath } from "../src/lib/utils";
import { buildIcsCalendar } from "../src/lib/calendar";
import { sanitizeRsvpResponseData } from "../src/lib/rsvp-fields";
import { buildEmailFooter, buildInvitationEmail, buildReminderEmail } from "../src/lib/email-templates";
import { buildInviteSms, buildReminderSms } from "../src/lib/sms-templates";
import { isAuthorizedCron } from "../src/lib/auth/cron-auth";
import { removeCommunicationSuppressionsStatement } from "../src/lib/communication-suppressions";
import { GET as getUpload, HEAD as headUpload } from "../src/app/api/uploads/[...path]/route";
import { POST as postCheckout } from "../src/app/api/checkout/route";

test("isValidRelativePath rejects backslash and scheme-relative redirects", () => {
  assert.equal(isValidRelativePath("/dashboard"), true);
  assert.equal(isValidRelativePath("/e/my-party?tab=1"), true);
  assert.equal(isValidRelativePath("/\\evil.com"), false);
  assert.equal(isValidRelativePath("//evil.com"), false);
  assert.equal(isValidRelativePath("https://evil.com"), false);
  assert.equal(isValidRelativePath("/ok\r\nLocation: evil"), false);
});

test("buildIcsCalendar escapes bare carriage returns", () => {
  const ics = buildIcsCalendar({
    id: "evt-1",
    slug: "party",
    title: "Party\rX-INJECTED:yes",
    description: "Line1\rLine2",
    eventDate: "2026-07-01T18:00:00.000Z",
    eventTimezone: "UTC",
  });
  assert.doesNotMatch(ics, /\rX-INJECTED:/);
  assert.match(ics, /SUMMARY:Party\\nX-INJECTED:yes/);
  assert.match(ics, /DESCRIPTION:Line1\\nLine2/);
});

test("sanitizeRsvpResponseData strips unknown keys while keeping configured and historical keys", () => {
  const fields = [
    {
      id: "f1",
      event_id: "e1",
      field_name: "meal_choice",
      field_label: "Meal",
      field_type: "text",
      options: null,
      placeholder: null,
      is_required: false,
      is_enabled: true,
      sort_order: 1,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  const sanitized = sanitizeRsvpResponseData(
    fields as never,
    { meal_choice: "Pasta", "=CMD|' /C calc'!A0": "pwn", legacy_note: "keep" },
    { legacy_note: "old" },
  );
  assert.deepEqual(sanitized, { meal_choice: "Pasta", legacy_note: "keep" });
});

test("uploads route blocks encoded social-private bypass and serves Range/HEAD for public uploads", async () => {
  const origCwd = process.cwd();
  const tmp = mkdtempSync(join(tmpdir(), "sealsend-upload-test-"));
  try {
    mkdirSync(join(tmp, "uploads", "u1", "social-private"), { recursive: true });
    writeFileSync(join(tmp, "uploads", "u1", "social-private", "secret.webp"), Buffer.from("PRIVATE_DATA"));
    writeFileSync(join(tmp, "uploads", "u1", "cover.webp"), Buffer.from("0123456789ABCDEF"));
    process.chdir(tmp);

    const bypass = await getUpload(
      new NextRequest("http://localhost/api/uploads/u1/social-private%2Fsecret.webp"),
      { params: Promise.resolve({ path: ["u1", "social-private/secret.webp"] }) },
    );
    assert.equal(bypass.status, 404);

    const head = await headUpload(
      new NextRequest("http://localhost/api/uploads/u1/cover.webp", { method: "HEAD" }),
      { params: Promise.resolve({ path: ["u1", "cover.webp"] }) },
    );
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), "16");
    assert.equal(head.headers.get("accept-ranges"), "bytes");

    const partial = await getUpload(
      new NextRequest("http://localhost/api/uploads/u1/cover.webp", { headers: { range: "bytes=0-3" } }),
      { params: Promise.resolve({ path: ["u1", "cover.webp"] }) },
    );
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), "bytes 0-3/16");
    assert.equal(await partial.text(), "0123");
  } finally {
    process.chdir(origCwd);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("email and SMS templates format reminder/invite times in event timezone and absolutize upload image URLs", () => {
  const compliance = { hostName: "Host", unsubscribeUrl: "https://sealsend.app/u" };
  const reminder = buildReminderEmail({
    guestName: "Sam",
    eventTitle: "Dinner",
    eventDate: "2026-07-15T23:00:00.000Z",
    eventTimezone: "America/Los_Angeles",
    locationName: "Pier 7",
    rsvpUrl: "https://sealsend.app/e/dinner",
    compliance,
  });
  assert.match(reminder.html, /4:00 PM PDT/);

  const inviteSms = buildInviteSms({
    guestName: "Sam",
    eventTitle: "Dinner",
    eventDate: "2026-07-15T23:00:00.000Z",
    eventTimezone: "America/Los_Angeles",
    locationName: "Pier 7",
    rsvpUrl: "https://sealsend.app/e/dinner",
  });
  assert.match(inviteSms, /4:00 PM PDT/);

  const reminderSms = buildReminderSms({
    guestName: "Sam",
    eventTitle: "Dinner",
    eventDate: "2026-07-15T23:00:00.000Z",
    eventTimezone: "America/Los_Angeles",
    rsvpUrl: "https://sealsend.app/e/dinner",
  });
  assert.match(reminderSms, /4:00 PM PDT/);

  const invite = buildInvitationEmail({
    guestName: "Sam",
    eventTitle: "Dinner",
    eventDate: "2026-07-15T23:00:00.000Z",
    eventTimezone: "America/Los_Angeles",
    locationName: "Pier 7",
    designUrl: "/uploads/u1/cover.webp",
    rsvpUrl: "https://sealsend.app/e/dinner",
    brand: { name: "Studio", logoUrl: "/uploads/u1/logo.webp", whiteLabel: false },
    compliance,
  });
  assert.match(invite.html, /https:\/\/[^"]+\/uploads\/u1\/cover\.webp/);
  assert.match(buildEmailFooter({ name: "Studio", logoUrl: "/uploads/u1/logo.webp", whiteLabel: false }), /https:\/\/[^"]+\/uploads\/u1\/logo\.webp/);
});

test("removeCommunicationSuppressionsStatement only removes unsubscribed rows", () => {
  const stmt = removeCommunicationSuppressionsStatement({ channel: "sms", recipient: "+14165550100" });
  assert.match(stmt.text, /reason = 'unsubscribed'/);
});

test("isAuthorizedCron validates Bearer secret in constant time", () => {
  const prev = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "super-secret-value";
    assert.equal(isAuthorizedCron(new Request("http://localhost", { headers: { authorization: "Bearer super-secret-value" } })), true);
    assert.equal(isAuthorizedCron(new Request("http://localhost", { headers: { authorization: "Bearer wrong" } })), false);
    assert.equal(isAuthorizedCron(new Request("http://localhost")), false);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});

test("POST /api/checkout is blocked during BETA_MODE", async () => {
  const res = await postCheckout(new NextRequest("http://localhost/api/checkout", { method: "POST", body: "{}" }));
  assert.equal(res.status, 403);
});

test("Cloudflare platform modules use @/ aliases, wrap IMAGES in ReadableStream, and declare organizer price IDs", () => {
  const emailSrc = readFileSync("src/lib/email.ts", "utf8");
  assert.match(emailSrc, /from ['"]@\/lib\/runtime-bindings['"]/);
  assert.doesNotMatch(emailSrc, /from ['"]\.\/runtime-bindings['"]/);

  const imgSrc = readFileSync("src/lib/image-processor.cloudflare.ts", "utf8");
  assert.match(imgSrc, /new ReadableStream<Uint8Array>/);

  const cfConfig = readFileSync("cloudflare.config.ts", "utf8");
  for (const name of [
    "STRIPE_ORGANIZER_SOLO_PRICE_ID",
    "STRIPE_ORGANIZER_STUDIO_PRICE_ID",
    "STRIPE_ORGANIZER_AGENCY_PRICE_ID",
    "EMAIL_DAILY_LIMIT_PER_ACCOUNT",
    "DEFAULT_COUNTRY",
  ]) {
    assert.ok(cfConfig.includes(name), `cloudflare.config.ts must declare ${name}`);
  }
});
