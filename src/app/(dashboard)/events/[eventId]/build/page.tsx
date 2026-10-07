import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { query, queryOne } from '@/lib/db/client';
import { getEventAccess, roleCan } from '@/lib/auth/event-access';
import { EventBuilder } from '@/components/events/builder/EventBuilder';
import { isAiChatConfigured } from '@/lib/ai/provider';
import { fromEvent } from '@/lib/event-builder/mapping';
import type { Event, RSVPField } from '@/types/database';

export const metadata: Metadata = {
  title: 'Build Event',
};

export default async function BuildEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const { eventId } = await params;
  // The chat's "Review & publish" lands here with ?step=review.
  const { step } = await searchParams;
  const initialScreen = step === 'review' ? 'review' : undefined;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const access = await getEventAccess(user.id, eventId);
  if (!access || !roleCan(access.role, 'edit_event')) notFound();

  const event = await queryOne<Event>('SELECT * FROM events WHERE id = $1', [eventId]);
  if (!event) notFound();
  if (event.status === 'archived') redirect(`/events/${eventId}`);

  const rsvpFields = await query<RSVPField>(
    'SELECT * FROM rsvp_fields WHERE event_id = $1 ORDER BY sort_order ASC',
    [eventId],
  );

  return (
    <div className="py-8">
      <div className="mx-auto max-w-6xl">
        <EventBuilder
          mode="create"
          eventId={eventId}
          aiChatEnabled={isAiChatConfigured()}
          initial={fromEvent(event, rsvpFields)}
          initialStatus={event.status === 'published' ? 'published' : 'draft'}
          initialScreen={initialScreen}
        />
      </div>
    </div>
  );
}
