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

  const linkClass =
    'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink';

  return (
    <details className="rounded-lg border border-neutral-400">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
        Add to calendar
      </summary>
      <div className="border-t border-border p-1">
        <a href={links.google} target="_blank" rel="noopener noreferrer" className={linkClass}>Google</a>
        <a href={links.ics} className={linkClass} download>Apple / iCal</a>
        <a href={links.outlook} target="_blank" rel="noopener noreferrer" className={linkClass}>Outlook</a>
      </div>
    </details>
  );
}
