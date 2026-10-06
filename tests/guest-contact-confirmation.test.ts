import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CONTACT_CONFIRMATION_MESSAGE,
  contactConfirmationAudit,
  contactConfirmationError,
} from "../src/lib/guest-contact-confirmation";
import { isReminderTarget, REMINDER_TARGET_SQL } from "../src/lib/reminder-targets";

test("contact confirmation: missing, false or odd bodies are rejected with the exact message", () => {
  assert.equal(CONTACT_CONFIRMATION_MESSAGE, "Please confirm these guests know you and expect to hear from you.");
  for (const body of [undefined, null, {}, { contactConfirmed: false }, { contactConfirmed: "true" }, { contactConfirmed: 1 }, "x", []]) {
    assert.equal(contactConfirmationError(body), CONTACT_CONFIRMATION_MESSAGE, JSON.stringify(body));
  }
  assert.equal(contactConfirmationError({ contactConfirmed: true }), null);
});

test("contact confirmation: audit record carries kind and count", () => {
  assert.deepEqual(contactConfirmationAudit("reminders", 4), { action: "guest_contact_confirmed", metadata: { kind: "reminders", count: 4 } });
});

test("reminder targeting: never invited, declined and replied guests are excluded", () => {
  const sent = { invite_status: "sent", reminder_sent_at: null };
  assert.equal(isReminderTarget({ ...sent, invite_status: "not_sent" }, null), false);
  assert.equal(isReminderTarget({ ...sent, invite_status: "failed" }, null), false);
  assert.equal(isReminderTarget(sent, "not_attending"), false);
  assert.equal(isReminderTarget(sent, "attending"), false);
  assert.equal(isReminderTarget(sent, "maybe"), false);
  assert.equal(isReminderTarget({ ...sent, reminder_sent_at: new Date() }, null), false);
  assert.equal(isReminderTarget(sent, null), true);
});

test("reminder targeting: cron mode skips only decliners, still needs an invitation", () => {
  const sent = { invite_status: "sent", reminder_sent_at: null };
  assert.equal(isReminderTarget({ ...sent, invite_status: "not_sent" }, null, { includeReplied: true }), false);
  assert.equal(isReminderTarget(sent, "not_attending", { includeReplied: true }), false);
  assert.equal(isReminderTarget(sent, "attending", { includeReplied: true }), true);
  assert.equal(isReminderTarget(sent, null, { includeReplied: true }), true);
  assert.match(REMINDER_TARGET_SQL, /invite_status = 'sent'/);
});

test("routes wire the confirmation and targeting rule", async () => {
  const read = (p: string) => readFile(new URL(`../${p}`, import.meta.url), "utf8");
  for (const [file, kind] of [
    ["src/app/api/events/[eventId]/send-invites/route.ts", "invites"],
    ["src/app/api/events/[eventId]/send-reminders/route.ts", "reminders"],
    ["src/app/api/events/[eventId]/announcements/route.ts", "announcement"],
  ] as const) {
    const src = await read(file);
    assert.match(src, /contactConfirmationError\(/, file);
    assert.match(src, /status: 400/, file);
    assert.ok(src.includes(`recordGuestContactConfirmation(`) && src.includes(`"${kind}"`), file);
    assert.ok(src.indexOf("contactConfirmationError(") < src.indexOf("recordGuestContactConfirmation("), file);
  }
  const reminders = await read("src/app/api/events/[eventId]/send-reminders/route.ts");
  assert.match(reminders, /isReminderTarget|REMINDER_TARGET_SQL/);
  const cron = await read("src/app/api/cron/send-reminders/route.ts");
  assert.match(cron, /REMINDER_TARGET_SQL|invite_status = 'sent'/);
  const modal = await read("src/components/dashboard/SendAnnouncementModal.tsx");
  assert.match(modal, /contactConfirmed: true/);
  const page = await read("src/app/(dashboard)/events/[eventId]/guests/page.tsx");
  assert.equal((page.match(/contactConfirmed: true/g) ?? []).length, 2);
});
