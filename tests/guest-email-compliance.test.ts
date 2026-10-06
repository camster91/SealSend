import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildAnnouncementEmail, buildEmailFooter, buildInvitationEmail, buildReminderEmail, type EmailCompliance } from "../src/lib/email-templates";
import { guestEmailCompliance, guestEmailSendOptions, resolveHostDisplayName, type GuestEmailSender } from "../src/lib/guest-email";
import { SENDER_LEGAL_NAME, SENDER_POSTAL_ADDRESS, SUPPORT_EMAIL } from "../src/lib/legal";
import { createUnsubscribeToken } from "../src/lib/unsubscribe";
import type { EventBranding } from "../src/lib/brands";

process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret-that-is-long-enough-123";
process.env.NEXT_PUBLIC_SITE_URL = "https://sealsend.app";
process.env.FROM_EMAIL = "SealSend <noreply@sealsend.app>";

const OWNER = "8a6b2c1e-1111-4222-8333-944455556666";
const compliance: EmailCompliance = { hostName: "Jane <Smith> & Co", unsubscribeUrl: "https://sealsend.app/unsubscribe/abc.def" };

const branding: EventBranding = {
  name: "Bloom Events",
  logoUrl: "https://cdn.example.com/logo.png",
  primaryColor: null,
  backgroundColor: null,
  fontFamily: null,
  senderName: null,
  replyToEmail: null,
  smsSignature: null,
  whiteLabel: false,
};

test("legal constants hold the sender's postal address and support email", () => {
  assert.equal(SENDER_LEGAL_NAME, "Ashbi Design");
  assert.equal(SENDER_POSTAL_ADDRESS, "95 Ellesmere Road Suite 1006, Scarborough, ON M1R 4B7, Canada");
  assert.equal(SUPPORT_EMAIL, "support@sealsend.app");
});

test("the compliance footer names the host, the postal address, support and the unsubscribe link", () => {
  const footer = buildEmailFooter(null, compliance);
  assert.match(footer, /Sent by Jane &lt;Smith&gt; &amp; Co using SealSend/);
  assert.doesNotMatch(footer, /Jane <Smith>/, "host name is HTML-escaped");
  assert.ok(footer.includes(`Ashbi Design, ${SENDER_POSTAL_ADDRESS}`));
  assert.match(footer, /support@sealsend\.app/);
  assert.match(footer, /<a [^>]*href="https:\/\/sealsend\.app\/unsubscribe\/abc\.def"[^>]*>Unsubscribe<\/a>/);
});

test("the compliance footer keeps today's brand logo and name", () => {
  const footer = buildEmailFooter({ name: "Bloom", logoUrl: "https://cdn.example.com/l.png", whiteLabel: false }, compliance);
  assert.match(footer, /<img src="https:\/\/cdn\.example\.com\/l\.png"/);
  assert.match(footer, />Bloom<\/p>/);
  assert.match(footer, /Unsubscribe<\/a>/);
});

test("the unsubscribe URL in the footer is attribute-escaped", () => {
  const footer = buildEmailFooter(null, { hostName: "Jane", unsubscribeUrl: "https://sealsend.app/unsubscribe/a\"onmouseover=\"x" });
  assert.doesNotMatch(footer, /"onmouseover="/);
});

test("all three guest templates carry the compliance footer", () => {
  const invite = buildInvitationEmail({ guestName: "G", eventTitle: "T", eventDate: null, locationName: null, rsvpUrl: "https://sealsend.app/x", compliance });
  const reminder = buildReminderEmail({ guestName: "G", eventTitle: "T", eventDate: null, locationName: null, rsvpUrl: "https://sealsend.app/x", compliance });
  const announcement = buildAnnouncementEmail({ guestName: "G", eventTitle: "T", announcementSubject: "S", announcementMessage: "M", rsvpUrl: "https://sealsend.app/x", compliance });
  for (const { html } of [invite, reminder, announcement]) {
    assert.match(html, /Sent by Jane &lt;Smith&gt; &amp; Co using SealSend/);
    assert.match(html, /href="https:\/\/sealsend\.app\/unsubscribe\/abc\.def"/);
    assert.ok(html.includes(SENDER_POSTAL_ADDRESS));
  }
});

test("host display name: brand display name, then event host name, then account name, then 'Your host'", () => {
  assert.equal(resolveHostDisplayName({ brandName: "Bloom", eventHostName: "Jane", accountName: "Jane S" }), "Bloom");
  assert.equal(resolveHostDisplayName({ brandName: null, eventHostName: " Jane ", accountName: "Jane S" }), "Jane");
  assert.equal(resolveHostDisplayName({ brandName: "  ", eventHostName: "", accountName: "Jane S" }), "Jane S");
  assert.equal(resolveHostDisplayName({ brandName: null, eventHostName: null, accountName: null }), "Your host");
});

test("guestEmailCompliance builds a per-recipient footer link and List-Unsubscribe headers", () => {
  const sender: GuestEmailSender = { ownerUserId: OWNER, hostName: "Jane", ownerEmail: "jane@example.com" };
  const result = guestEmailCompliance(sender, "Guest@Example.com");
  const token = createUnsubscribeToken(OWNER, "guest@example.com");
  assert.deepEqual(result.compliance, { hostName: "Jane", unsubscribeUrl: `https://sealsend.app/unsubscribe/${token}` });
  assert.deepEqual(result.headers, {
    "List-Unsubscribe": `<https://sealsend.app/api/unsubscribe/${token}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
  const other = guestEmailCompliance(sender, "other@example.com");
  assert.notEqual(other.compliance.unsubscribeUrl, result.compliance.unsubscribeUrl);
});

test("replies go to the host: brand reply-to wins, else the owner's account email; From never changes", () => {
  const sender: GuestEmailSender = { ownerUserId: OWNER, hostName: "Jane", ownerEmail: "jane@example.com" };
  assert.deepEqual(guestEmailSendOptions(null, sender), { replyTo: "jane@example.com" });
  assert.deepEqual(guestEmailSendOptions(branding, sender), {
    from: "\"Bloom Events via SealSend\" <noreply@sealsend.app>",
    replyTo: "jane@example.com",
  });
  assert.deepEqual(guestEmailSendOptions({ ...branding, replyToEmail: "hello@bloom.example" }, sender), {
    from: "\"Bloom Events via SealSend\" <noreply@sealsend.app>",
    replyTo: "hello@bloom.example",
  });
  assert.deepEqual(guestEmailSendOptions(null, { ...sender, ownerEmail: null }), {});
});

test("mailgun sends custom headers as h: fields and refuses header injection", async () => {
  const mailgun = await readFile("src/lib/mailgun.ts", "utf8");
  const email = await readFile("src/lib/email.ts", "utf8");
  assert.match(mailgun, /headers\?: Record<string, string>/);
  assert.match(mailgun, /messageData\[`h:\$\{name\}`\]/);
  assert.match(mailgun, /\[\\r\\n\]/);
  assert.match(email, /headers\?: Record<string, string>/);
  assert.match(email, /headers: params\.headers/);
});

test("every guest email send path passes the unsubscribe footer, headers and host reply-to", async () => {
  const paths = [
    "src/app/api/events/[eventId]/send-invites/route.ts",
    "src/app/api/events/[eventId]/send-reminders/route.ts",
    "src/app/api/cron/send-reminders/route.ts",
    "src/lib/messages/dispatch-announcement.ts",
  ];
  for (const path of paths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /getGuestEmailSender\(/, `${path} resolves the host`);
    assert.match(source, /guestEmailCompliance\(/, `${path} builds the per-recipient unsubscribe link`);
    // Allows one level of nested calls, e.g. `brand: emailBrand(branding), compliance`.
    assert.match(source, /build(?:Invitation|Reminder|Announcement)Email\(\{(?:[^()]|\([^()]*\))*?\bcompliance\b/, `${path} passes the footer`);
    assert.match(source, /sendEmail\(\{[^)]*guestEmailSendOptions\(branding, sender\)[^)]*\bheaders\b/, `${path} sends List-Unsubscribe and Reply-To`);
    assert.doesNotMatch(source, /\.\.\.emailSendOptions\(branding\)/, `${path} must use guestEmailSendOptions`);
  }
});

test("signed-out visitors and mail providers can reach unsubscribe", async () => {
  const proxy = await readFile("src/proxy.ts", "utf8");
  const publicList = proxy.slice(proxy.indexOf("const publicPaths = ["), proxy.indexOf("];", proxy.indexOf("const publicPaths = [")));
  assert.match(publicList, /'\/unsubscribe'/);
  assert.match(proxy, /!pathname\.startsWith\('\/api\/unsubscribe\/'\)/);
  const route = await readFile("src/app/api/unsubscribe/[token]/route.ts", "utf8");
  assert.match(route, /export async function POST/);
  assert.match(route, /rateLimit\(/);
  assert.match(route, /handleUnsubscribe\(/);
});
