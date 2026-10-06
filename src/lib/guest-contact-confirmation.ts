import { query } from "@/lib/db/client";

export const CONTACT_CONFIRMATION_MESSAGE = "Please confirm these guests know you and expect to hear from you.";

export type ContactConfirmationKind = "invites" | "reminders" | "announcement";

/** Returns the 400 message unless the body explicitly says `contactConfirmed: true`. */
export function contactConfirmationError(body: unknown): string | null {
  if (body && typeof body === "object" && (body as { contactConfirmed?: unknown }).contactConfirmed === true) return null;
  return CONTACT_CONFIRMATION_MESSAGE;
}

export function contactConfirmationAudit(kind: ContactConfirmationKind, count: number) {
  return { action: "guest_contact_confirmed", metadata: { kind, count } };
}

/** Records the host's confirmation next to the send it allowed. */
export async function recordGuestContactConfirmation(
  eventId: string,
  userId: string,
  kind: ContactConfirmationKind,
  count: number,
): Promise<void> {
  const audit = contactConfirmationAudit(kind, count);
  await query(
    `INSERT INTO event_audit_log (event_id, actor_user_id, action, metadata)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [eventId, userId, audit.action, JSON.stringify(audit.metadata)],
  );
}
