import assert from "node:assert/strict";
import test from "node:test";

import {
  brandInputSchema,
  canWhiteLabel,
  emailFromHeader,
  emailSendOptions,
  mergeBrandIntoCustomization,
  smsSignature,
  toBrandColumns,
  toEventBranding,
  type Brand,
  type EventBranding,
} from "../src/lib/brands";
import { buildEmailFooter } from "../src/lib/email-templates";
import { buildInviteSms, DEFAULT_SMS_SIGNATURE } from "../src/lib/sms-templates";
import { organizationRoleCan } from "../src/lib/auth/organization-access";

const brand: Brand = {
  id: "b1",
  organization_id: "o1",
  name: "Bloom Events",
  logo_url: "https://cdn.example.com/logo.png",
  primary_color: "#112233",
  background_color: null,
  font_family: "Georgia",
  sender_name: "Bloom",
  reply_to_email: "hi@bloom.example",
  sms_signature: null,
  white_label: true,
};

test("white-labelling only takes effect on organizer workspace plans", () => {
  assert.equal(canWhiteLabel("personal"), false);
  assert.equal(canWhiteLabel("solo"), true);
  assert.equal(canWhiteLabel("studio"), true);
  assert.equal(canWhiteLabel(null), false);
  assert.equal(toEventBranding(brand, "personal")?.whiteLabel, false);
  assert.equal(toEventBranding(brand, "agency")?.whiteLabel, true);
  assert.equal(toEventBranding(null, "agency"), null);
});

test("event customization wins and the brand fills only what the event left unset", () => {
  const branding = toEventBranding(brand, "personal");
  const merged = mergeBrandIntoCustomization({ primaryColor: "#abcdef", fontFamily: "" }, branding);
  assert.equal(merged.primaryColor, "#abcdef");
  assert.equal(merged.fontFamily, "Georgia");
  assert.equal(merged.logoUrl, "https://cdn.example.com/logo.png");
  assert.equal("backgroundColor" in merged, false);
  assert.deepEqual(mergeBrandIntoCustomization({ primaryColor: "#000000" }, null), { primaryColor: "#000000" });
});

test("SMS signatures credit SealSend unless the brand is white-labelled", () => {
  const plain = toEventBranding(brand, "personal") as EventBranding;
  const whiteLabel = toEventBranding(brand, "solo") as EventBranding;
  assert.equal(smsSignature(null), DEFAULT_SMS_SIGNATURE);
  assert.equal(smsSignature(plain), "- Bloom Events via Seal and Send");
  assert.equal(smsSignature(whiteLabel), "- Bloom Events");
  assert.equal(smsSignature({ ...whiteLabel, smsSignature: "Team Bloom" }), "- Team Bloom");

  const sms = buildInviteSms({ guestName: "Ana", eventTitle: "Gala", eventDate: null, locationName: null, rsvpUrl: "https://x", signature: smsSignature(plain) });
  assert.match(sms, /- Bloom Events via Seal and Send$/);
  assert.match(buildInviteSms({ guestName: "Ana", eventTitle: "Gala", eventDate: null, locationName: null, rsvpUrl: "https://x" }), /- Sent via Seal and Send$/);
});

test("the From header keeps SealSend's verified address and strips header-breaking characters", () => {
  const plain = toEventBranding(brand, "personal") as EventBranding;
  assert.equal(emailFromHeader(plain, "SealSend <noreply@sealsend.app>"), "\"Bloom via SealSend\" <noreply@sealsend.app>");
  assert.equal(emailFromHeader({ ...plain, whiteLabel: true }, "noreply@sealsend.app"), "\"Bloom\" <noreply@sealsend.app>");
  assert.equal(emailFromHeader({ ...plain, senderName: "Evil\"\r\nBcc: x@y" }, "noreply@sealsend.app"), "\"EvilBcc: x@y via SealSend\" <noreply@sealsend.app>");
  assert.equal(emailFromHeader(null, "noreply@sealsend.app"), "noreply@sealsend.app");
  assert.deepEqual(emailSendOptions(plain, "noreply@sealsend.app"), { from: "\"Bloom via SealSend\" <noreply@sealsend.app>", replyTo: "hi@bloom.example" });
  assert.deepEqual(emailSendOptions(null, "noreply@sealsend.app"), {});
});

test("the email footer escapes brand text and hides SealSend only for white-label", () => {
  assert.match(buildEmailFooter(null), /Seal<\/span><span[^>]*>Send/);
  const branded = buildEmailFooter({ name: "<Bloom & Co>", logoUrl: "https://cdn.example.com/l.png", whiteLabel: false });
  assert.match(branded, /&lt;Bloom &amp; Co&gt;/);
  assert.match(branded, /Sent with SealSend/);
  assert.match(branded, /<img src="https:\/\/cdn\.example\.com\/l\.png"/);
  assert.doesNotMatch(buildEmailFooter({ name: "Bloom", whiteLabel: true }), /SealSend/);
  assert.doesNotMatch(buildEmailFooter({ name: "Bloom", logoUrl: "javascript:alert(1)", whiteLabel: true }), /<img/);
});

test("brand input is validated and unsafe values are dropped", () => {
  assert.equal(brandInputSchema.safeParse({ name: "" }).success, false);
  assert.equal(brandInputSchema.safeParse({ name: "Bloom", primaryColor: "red" }).success, false);
  assert.equal(brandInputSchema.safeParse({ name: "Bloom", replyToEmail: "not-an-email" }).success, false);
  const parsed = brandInputSchema.parse({ name: " Bloom ", replyToEmail: "", senderName: "", fontFamily: "Comic <script>" });
  const columns = toBrandColumns(parsed);
  assert.equal(columns.name, "Bloom");
  assert.equal(columns.reply_to_email, null);
  assert.equal(columns.sender_name, null);
  assert.equal(columns.font_family, "Inter");
  assert.equal(toBrandColumns(brandInputSchema.parse({ name: "B", logoUrl: "javascript:alert(1)" })).logo_url, null);
});

test("only workspace owners and admins can change the brand or members", () => {
  assert.equal(organizationRoleCan("owner", "manage_brand"), true);
  assert.equal(organizationRoleCan("admin", "manage_members"), true);
  assert.equal(organizationRoleCan("planner", "manage_brand"), false);
  assert.equal(organizationRoleCan("planner", "manage_clients"), true);
  assert.equal(organizationRoleCan("check_in", "view_organization"), true);
  assert.equal(organizationRoleCan("check_in", "manage_clients"), false);
  assert.equal(organizationRoleCan("superuser", "view_organization"), false);
});

test("admins manage planners and check-in staff; only owners manage owners and admins", async () => {
  const { canManageMemberRole, organizationSeatLimit, INVITABLE_ORGANIZATION_ROLES } = await import("../src/lib/auth/organization-access");
  assert.equal(canManageMemberRole("owner", "owner"), true);
  assert.equal(canManageMemberRole("owner", "admin"), true);
  assert.equal(canManageMemberRole("admin", "planner"), true);
  assert.equal(canManageMemberRole("admin", "check_in"), true);
  assert.equal(canManageMemberRole("admin", "admin"), false);
  assert.equal(canManageMemberRole("admin", "owner"), false);
  assert.equal(canManageMemberRole("planner", "check_in"), false);
  assert.deepEqual([...INVITABLE_ORGANIZATION_ROLES], ["admin", "planner", "check_in"]);
  assert.equal(organizationSeatLimit("personal"), 2);
  assert.equal(organizationSeatLimit("studio"), 5);
  assert.equal(organizationSeatLimit("unknown-plan"), 2);
});
