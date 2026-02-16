'use client';

import type { Event } from '@/types/database';

interface AddToCalendarProps {
  event: Event;
}

function formatICSDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function getEndDate(event: Event): string {
  if (event.event_end_date) return event.event_end_date;
  // Default: start + 2 hours
  const start = new Date(event.event_date!);
  return new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString();
}

function buildGoogleUrl(event: Event): string {
  const start = formatICSDate(event.event_date!);
  const end = formatICSDate(getEndDate(event));
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
  });
  if (event.description) params.set('details', event.description);
  if (event.location_name) {
    params.set('location', event.location_address
      ? `${event.location_name}, ${event.location_address}`
      : event.location_name);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookUrl(event: Event): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: new Date(event.event_date!).toISOString(),
    enddt: new Date(getEndDate(event)).toISOString(),
  });
  if (event.description) params.set('body', event.description);
  if (event.location_name) {
    params.set('location', event.location_address
      ? `${event.location_name}, ${event.location_address}`
      : event.location_name);
  }
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

function downloadICS(event: Event) {
  const start = formatICSDate(event.event_date!);
  const end = formatICSDate(getEndDate(event));
  const location = event.location_name
    ? event.location_address
      ? `${event.location_name}, ${event.location_address}`
      : event.location_name
    : '';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Seal and Send//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
    location ? `LOCATION:${location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AddToCalendar({ event }: AddToCalendarProps) {
  if (!event.event_date) return null;

  const btnClass =
    'inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-neutral-50';

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Add to calendar</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={buildGoogleUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className={btnClass}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM12 17.25a.75.75 0 110-1.5.75.75 0 010 1.5zM12.75 13.5a.75.75 0 01-1.5 0v-6a.75.75 0 011.5 0v6z" />
          </svg>
          Google
        </a>
        <button onClick={() => downloadICS(event)} className={btnClass}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          Apple / iCal
        </button>
        <a
          href={buildOutlookUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className={btnClass}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM12 17.25a.75.75 0 110-1.5.75.75 0 010 1.5zM12.75 13.5a.75.75 0 01-1.5 0v-6a.75.75 0 011.5 0v6z" />
          </svg>
          Outlook
        </a>
      </div>
    </div>
  );
}
