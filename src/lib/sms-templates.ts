import { formatDateTime } from "@/lib/utils";

/** Strip characters that could be used for SMS injection (e.g. GSM concatenation exploits) */
function sanitize(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, 300);
}

interface InviteSmsParams {
  guestName: string;
  eventTitle: string;
  eventDate: string | null;
  locationName: string | null;
  hostName?: string;
  rsvpUrl: string;
}

export function buildInviteSms(params: InviteSmsParams): string {
  const guestName = sanitize(params.guestName);
  const eventTitle = sanitize(params.eventTitle);
  const { eventDate, locationName, hostName, rsvpUrl } = params;

  const lines: string[] = [];
  lines.push(`Hi ${guestName}! You're invited to ${eventTitle}.`);

  if (eventDate) {
    lines.push(`When: ${formatDateTime(eventDate)}`);
  }
  if (locationName) {
    lines.push(`Where: ${sanitize(locationName)}`);
  }
  if (hostName) {
    lines.push(`Host: ${sanitize(hostName)}`);
  }

  lines.push(`\nRSVP here: ${rsvpUrl}`);
  lines.push(`\n- Sent via Seal and Send`);

  return lines.join("\n");
}

interface ReminderSmsParams {
  guestName: string;
  eventTitle: string;
  eventDate: string | null;
  rsvpUrl: string;
}

export function buildReminderSms(params: ReminderSmsParams): string {
  const guestName = sanitize(params.guestName);
  const eventTitle = sanitize(params.eventTitle);
  const { eventDate, rsvpUrl } = params;

  const lines: string[] = [];
  lines.push(`Hi ${guestName}, reminder about ${eventTitle}!`);

  if (eventDate) {
    lines.push(`Date: ${formatDateTime(eventDate)}`);
  }

  lines.push(`\nView event: ${rsvpUrl}`);
  lines.push(`\n- Sent via Seal and Send`);

  return lines.join("\n");
}

interface AnnouncementSmsParams {
  guestName: string;
  eventTitle: string;
  subject: string;
  rsvpUrl: string;
}

export function buildAnnouncementSms(params: AnnouncementSmsParams): string {
  const guestName = sanitize(params.guestName);
  const eventTitle = sanitize(params.eventTitle);
  const subject = sanitize(params.subject);
  const { rsvpUrl } = params;

  return `Hi ${guestName}, update for ${eventTitle}: ${subject}\n\nDetails: ${rsvpUrl}\n\n- Sent via Seal and Send`;
}
