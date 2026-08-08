export interface CalendarEvent {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  eventDate: string;
  eventEndDate?: string | null;
  eventTimezone: string;
  locationName?: string | null;
  locationAddress?: string | null;
  updatedAt?: string | null;
}

function parseInstant(value: string, label: string): Date {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}`);
  }
  return date;
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function calendarLocation(event: CalendarEvent): string {
  return [event.locationName, event.locationAddress].filter(Boolean).join(", ");
}

export function buildIcsCalendar(
  event: CalendarEvent,
  generatedAt = new Date(),
  siteUrl = "https://sealsend.app",
): string {
  const start = parseInstant(event.eventDate, "event date");
  const end = event.eventEndDate
    ? parseInstant(event.eventEndDate, "event end date")
    : new Date(start.getTime() + 60 * 60 * 1000);
  if (end <= start) throw new Error("Event end date must be after event date");

  const updatedAt = event.updatedAt
    ? parseInstant(event.updatedAt, "updated date")
    : generatedAt;
  const baseUrl = siteUrl.replace(/\/$/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SealSend//Event Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@sealsend.app`,
    `DTSTAMP:${formatUtc(generatedAt)}`,
    `LAST-MODIFIED:${formatUtc(updatedAt)}`,
    `SEQUENCE:${Math.floor(updatedAt.getTime() / 1000)}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description ?? "")}`,
    `LOCATION:${escapeIcs(calendarLocation(event))}`,
    `URL:${baseUrl}/e/${encodeURIComponent(event.slug)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];

  return lines.join("\r\n");
}

export function buildCalendarLinks(
  event: CalendarEvent,
  siteUrl = "https://sealsend.app",
): { google: string; outlook: string; ics: string } {
  const start = parseInstant(event.eventDate, "event date");
  const end = event.eventEndDate
    ? parseInstant(event.eventEndDate, "event end date")
    : new Date(start.getTime() + 60 * 60 * 1000);
  const baseUrl = siteUrl.replace(/\/$/, "");
  const google = new URL("https://calendar.google.com/calendar/render");
  google.searchParams.set("action", "TEMPLATE");
  google.searchParams.set("text", event.title);
  google.searchParams.set("dates", `${formatUtc(start)}/${formatUtc(end)}`);
  google.searchParams.set("details", event.description ?? "");
  google.searchParams.set("location", calendarLocation(event));
  google.searchParams.set("ctz", event.eventTimezone);
  google.searchParams.set("sprop", `${baseUrl}/e/${encodeURIComponent(event.slug)}`);

  const outlook = new URL("https://outlook.live.com/calendar/0/action/compose");
  outlook.searchParams.set("path", "/calendar/action/compose");
  outlook.searchParams.set("rru", "addevent");
  outlook.searchParams.set("subject", event.title);
  outlook.searchParams.set("startdt", start.toISOString());
  outlook.searchParams.set("enddt", end.toISOString());
  outlook.searchParams.set("body", event.description ?? "");
  outlook.searchParams.set("location", calendarLocation(event));

  return {
    google: google.toString(),
    outlook: outlook.toString(),
    ics: `/api/calendar/${encodeURIComponent(event.slug)}`,
  };
}
