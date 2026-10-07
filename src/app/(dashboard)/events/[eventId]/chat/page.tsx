import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { query, queryOne } from '@/lib/db/client';
import { getEventAccess, roleCan } from '@/lib/auth/event-access';
import { isAiChatConfigured } from '@/lib/ai/provider';
import { ChatBuilder } from '@/components/events/builder/chat/ChatBuilder';
import { fromEvent } from '@/lib/event-builder/mapping';
import type { Event, RSVPField } from '@/types/database';

export const metadata: Metadata = {
  title: 'Chat to Build Event',
};

export default async function ChatEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const access = await getEventAccess(user.id, eventId);
  if (!access || !roleCan(access.role, 'edit_event')) notFound();

  // Without the chat set up, the manual builder is the only way in.
  if (!isAiChatConfigured()) redirect(`/events/${eventId}/build`);

  const event = await queryOne<Event>('SELECT * FROM events WHERE id = $1', [eventId]);
  if (!event) notFound();
  if (event.status === 'archived') redirect(`/events/${eventId}`);
  // A live invite is edited in the manual editor, where its publication checks can be fixed.
  if (event.status === 'published') redirect(`/events/${eventId}/edit`);

  const rsvpFields = await query<RSVPField>(
    'SELECT * FROM rsvp_fields WHERE event_id = $1 ORDER BY sort_order ASC',
    [eventId],
  );

  return (
    <div className="py-8">
      <div className="mx-auto max-w-6xl">
        <ChatBuilder eventId={eventId} initial={fromEvent(event, rsvpFields)} resumed />
      </div>
    </div>
  );
}
