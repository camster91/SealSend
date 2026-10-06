/**
 * Who may receive a reminder. A reminder only ever goes to someone who was
 * actually invited, and never to a guest who said they are not coming.
 * Manual reminders also skip guests who already replied, matching the
 * "haven't replied yet" wording in the dashboard. The scheduled job keeps
 * reminding guests who said yes or maybe (event-day details), so it passes
 * `includeReplied`.
 */
export type ReminderGuest = {
  invite_status: string;
  reminder_sent_at: string | Date | null;
};

export function isReminderTarget(
  guest: ReminderGuest,
  rsvpStatus: string | null | undefined,
  options: { includeReplied?: boolean } = {},
): boolean {
  if (guest.invite_status !== "sent") return false;
  if (guest.reminder_sent_at) return false;
  if (rsvpStatus === "not_attending") return false;
  if (rsvpStatus && !options.includeReplied) return false;
  return true;
}

/**
 * SQL twin of the rule above. Guests are aliased `g`; `r` must be the guest's
 * LATEST rsvp response (a LATERAL ... ORDER BY updated_at DESC LIMIT 1), never a
 * plain join, so an old decline cannot gate a newer reply and rows do not repeat.
 */
export const REMINDER_TARGET_SQL = `g.invite_status = 'sent'
           AND g.reminder_sent_at IS NULL
           AND (r.status IS NULL OR r.status <> 'not_attending')`;
