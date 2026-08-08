'use client';

import type { Event } from '@/types/database';
import { buildCalendarLinks } from '@/lib/calendar';

interface AddToCalendarProps {
  event: Event;
}

export function AddToCalendar({ event }: AddToCalendarProps) {
  if (!event.event_date) return null;

  const links = buildCalendarLinks({
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    eventDate: event.event_date,
    eventEndDate: event.event_end_date,
    eventTimezone: event.event_timezone,
    locationName: event.location_name,
    locationAddress: event.location_address,
    updatedAt: event.updated_at,
  });

  const btnClass =
    'inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-neutral-50';

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Add to calendar</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={links.google}
          target="_blank"
          rel="noopener noreferrer"
          className={btnClass}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM12 17.25a.75.75 0 110-1.5.75.75 0 010 1.5zM12.75 13.5a.75.75 0 01-1.5 0v-6a.75.75 0 011.5 0v6z" />
          </svg>
          Google
        </a>
        <a href={links.ics} className={btnClass} download>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          Apple / iCal
        </a>
        <a
          href={links.outlook}
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
