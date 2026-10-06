import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_EMAIL_DAILY_LIMIT, emailDailyLimit, emailQuotaKey, emailQuotaMessage } from "../src/lib/email-quota";

test("daily email limit defaults to 300 and accepts only positive integers", () => {
  assert.equal(DEFAULT_EMAIL_DAILY_LIMIT, 300);
  assert.equal(emailDailyLimit(undefined), 300);
  assert.equal(emailDailyLimit(""), 300);
  assert.equal(emailDailyLimit("abc"), 300);
  assert.equal(emailDailyLimit("0"), 300);
  assert.equal(emailDailyLimit("-5"), 300);
  assert.equal(emailDailyLimit("12.5"), 300);
  assert.equal(emailDailyLimit("1000"), 1000);
});

test("quota is keyed per event owner", () => {
  assert.equal(emailQuotaKey("user-1"), "email-daily:user-1");
  assert.notEqual(emailQuotaKey("user-1"), emailQuotaKey("user-2"));
});

test("quota message tells the host what is left and when to retry", () => {
  assert.match(emailQuotaMessage(100, 40, 300), /100 emails.*40 of its 300/);
  assert.match(emailQuotaMessage(5, 0, 300), /used its 300 emails.*tomorrow/);
});

test("every guest-facing email path reserves the owner's daily quota before sending", async () => {
  const paths = [
    "src/app/api/events/[eventId]/send-invites/route.ts",
    "src/app/api/events/[eventId]/send-reminders/route.ts",
    "src/app/api/cron/send-reminders/route.ts",
    "src/lib/messages/dispatch-announcement.ts",
  ];
  for (const path of paths) {
    const source = await readFile(path, "utf8");
    const reserve = source.indexOf("reserveEmailQuota(");
    const firstSend = source.indexOf("sendEmail(");
    assert.ok(reserve > 0, `${path} must call reserveEmailQuota`);
    assert.ok(firstSend > reserve, `${path} must reserve quota before its first sendEmail call`);
  }
});

test("batched quota is all-or-nothing and single attempts still work", async () => {
  const source = await readFile("src/lib/rate-limit.ts", "utf8");
  assert.match(source, /return consumeQuota\(key, 1, options\)/);
  assert.match(source, /currentCount \+ units > options\.max/);
  assert.match(source, /generate_series\(1, \$2::int\)/);
});
