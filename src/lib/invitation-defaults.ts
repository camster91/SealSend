export type InvitationCopyInput = {
  title: string;
  host_name?: string | null;
  event_date?: string | Date | null;
  event_timezone?: string | null;
  location_name?: string | null;
};

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value: string | Date | null | undefined, timeZone: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: clean(timeZone) || "UTC" }).format(date);
  } catch {
    // Unknown time zone name: fall back to UTC rather than skipping the date.
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
  }
}

export function defaultInvitationCopy(event: InvitationCopyInput): { headline: string; body: string } {
  const title = clean(event.title);
  const headline = title ? `You're invited: ${title}` : "You're invited";
  const host = clean(event.host_name) || "We";
  const when = formatDate(event.event_date, event.event_timezone);
  const place = clean(event.location_name);
  const body =
    `${host} would love for you to join us${when ? ` on ${when}` : ""}${place ? ` at ${place}` : ""}. ` +
    "Please let us know if you can make it.";
  return { headline, body };
}

export function withDefaultInvitationCopy<T extends { invitation_headline?: string | null; invitation_body?: string | null }>(
  event: T & InvitationCopyInput,
): T {
  const needsHeadline = !clean(event.invitation_headline);
  const needsBody = !clean(event.invitation_body);
  if (!needsHeadline && !needsBody) return event;
  const defaults = defaultInvitationCopy(event);
  return {
    ...event,
    invitation_headline: needsHeadline ? defaults.headline : event.invitation_headline,
    invitation_body: needsBody ? defaults.body : event.invitation_body,
  };
}

/** True when the stored text is exactly what SealSend would have written for this event. */
export function isDefaultInvitationCopy(
  event: InvitationCopyInput & { invitation_headline?: string | null; invitation_body?: string | null },
): { headline: boolean; body: boolean } {
  const defaults = defaultInvitationCopy(event);
  return {
    headline: clean(event.invitation_headline) === defaults.headline,
    body: clean(event.invitation_body) === defaults.body,
  };
}

/** Rewrites only the text SealSend wrote, so a changed date, time, place or title is not left stale. */
export function refreshDefaultInvitationCopy<T extends InvitationCopyInput & { invitation_headline?: string | null; invitation_body?: string | null }>(
  before: T,
  after: T,
): T {
  const was = isDefaultInvitationCopy(before);
  const next = defaultInvitationCopy(after);
  return {
    ...after,
    invitation_headline: was.headline && after.invitation_headline === before.invitation_headline ? next.headline : after.invitation_headline,
    invitation_body: was.body && after.invitation_body === before.invitation_body ? next.body : after.invitation_body,
  };
}
