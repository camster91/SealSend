import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { query, queryOne } from '@/lib/db/client';
import { EventBuilder } from '@/components/events/builder/EventBuilder';
import { isAiChatConfigured } from '@/lib/ai/provider';
import { isAiCoverConfigured } from '@/lib/ai/image-provider';
import { fromEvent } from '@/lib/event-builder/mapping';
import type { Event, RSVPField } from '@/types/database';
import type { Metadata } from 'next';
import { getEventAccess, roleCan } from '@/lib/auth/event-access';

export const metadata: Metadata = {
  title: 'Edit Event',
};

interface EditEventPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { eventId } = await params;

  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }
  const access = await getEventAccess(user.id, eventId);
  if (!access || !roleCan(access.role, 'edit_event')) notFound();

  const event = await queryOne<Event>(
    'SELECT * FROM events WHERE id = $1',
    [eventId]
  );

  if (!event) {
    notFound();
  }

  const rsvpFields = await query<RSVPField>(
    'SELECT * FROM rsvp_fields WHERE event_id = $1 ORDER BY sort_order ASC',
    [eventId]
  );

  return (
    <div className="py-8">
      <div className="mx-auto max-w-6xl">
        <EventBuilder
          mode="edit"
          eventId={eventId}
          aiChatEnabled={isAiChatConfigured()}
          aiCoverEnabled={isAiCoverConfigured()}
          initial={fromEvent(event, rsvpFields)}
          initialStatus={event.status === 'published' ? 'published' : 'draft'}
        />
      </div>
    </div>
  );
}
