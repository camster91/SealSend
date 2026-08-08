import assert from "node:assert/strict";
import test from "node:test";

import { buildCalendarLinks, buildIcsCalendar } from "../src/lib/calendar";

const event = {
  id: "e24c215f-9b71-4bf5-b65d-f807a50f5d52",
  slug: "client-dinner-abc123",
  title: "Client Dinner, Toronto",
  description: "Dinner; networking\nand conversation",
  eventDate: "2026-11-01T14:00:00.000Z",
  eventEndDate: "2026-11-01T16:00:00.000Z",
  eventTimezone: "America/Toronto",
  locationName: "Harbour Hall",
  locationAddress: "1 Bay St, Toronto",
};

test("builds a stable RFC 5545 calendar event with escaped content", () => {
  const ics = buildIcsCalendar(event, new Date("2026-08-08T12:00:00.000Z"));

  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /UID:e24c215f-9b71-4bf5-b65d-f807a50f5d52@sealsend\.app\r\n/);
  assert.match(ics, /DTSTART:20261101T140000Z\r\n/);
  assert.match(ics, /DTEND:20261101T160000Z\r\n/);
  assert.match(ics, /SUMMARY:Client Dinner\\, Toronto\r\n/);
  assert.match(ics, /DESCRIPTION:Dinner\\; networking\\nand conversation\r\n/);
  assert.match(ics, /LOCATION:Harbour Hall\\, 1 Bay St\\, Toronto\r\n/);
  assert.match(ics, /URL:https:\/\/sealsend\.app\/e\/client-dinner-abc123\r\n/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("calendar updates retain the same UID and increment sequence", () => {
  const first = buildIcsCalendar({ ...event, updatedAt: "2026-08-08T12:00:00.000Z" });
  const updated = buildIcsCalendar({ ...event, updatedAt: "2026-08-08T12:01:30.000Z" });

  assert.match(first, /SEQUENCE:1786190400\r\n/);
  assert.match(updated, /SEQUENCE:1786190490\r\n/);
  assert.equal(first.match(/UID:(.+)/)?.[1], updated.match(/UID:(.+)/)?.[1]);
});

test("builds a Google Calendar link from the same UTC instants", () => {
  const links = buildCalendarLinks(event);
  const google = new URL(links.google);

  assert.equal(google.hostname, "calendar.google.com");
  assert.equal(google.searchParams.get("dates"), "20261101T140000Z/20261101T160000Z");
  assert.equal(google.searchParams.get("ctz"), "America/Toronto");
  assert.equal(links.ics, "/api/calendar/client-dinner-abc123");
  const outlook = new URL(links.outlook);
  assert.equal(outlook.hostname, "outlook.live.com");
  assert.equal(outlook.searchParams.get("startdt"), "2026-11-01T14:00:00.000Z");
});

test("refuses calendar generation without a valid event instant", () => {
  assert.throws(
    () => buildIcsCalendar({ ...event, eventDate: "not-a-date" }),
    /event date/i,
  );
});
