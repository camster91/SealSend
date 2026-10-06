import { consumeQuota } from "@/lib/rate-limit";

// Per-account cap on guest-facing email (invites, reminders, announcements),
// counted against the event owner over a rolling 24 hours. With open sign-ups
// this is what stops one account from turning SealSend into a bulk mailer and
// getting the sending domain suspended. 300 covers a 100-guest event's
// invites, reminders and one update in a single day.
export const DEFAULT_EMAIL_DAILY_LIMIT = 300;
const WINDOW_SECONDS = 24 * 60 * 60;

export function emailDailyLimit(raw: string | undefined = process.env.EMAIL_DAILY_LIMIT_PER_ACCOUNT): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_EMAIL_DAILY_LIMIT;
}

export function emailQuotaKey(ownerUserId: string): string {
  return `email-daily:${ownerUserId}`;
}

export function emailQuotaMessage(requested: number, remaining: number, limit: number = emailDailyLimit()): string {
  return remaining > 0
    ? `This would send ${requested} emails, but this account has ${remaining} of its ${limit} daily emails left. Try fewer guests now, or send the rest tomorrow.`
    : `This account has used its ${limit} emails for the last 24 hours. Please try again tomorrow.`;
}

/** Reserve `emails` sends for the event owner. All-or-nothing; zero is always allowed. */
export async function reserveEmailQuota(ownerUserId: string, emails: number) {
  const limit = emailDailyLimit();
  if (emails <= 0) return { success: true, remaining: limit, limit };
  const result = await consumeQuota(emailQuotaKey(ownerUserId), emails, { max: limit, windowSeconds: WINDOW_SECONDS });
  return { success: result.success, remaining: result.remaining, limit };
}
