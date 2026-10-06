import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { query, queryOne } from '@/lib/db/client';
import WizardContainer from '@/components/events/wizard/WizardContainer';
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

  // Fetch the event
  const event = await queryOne<Event>(
    'SELECT * FROM events WHERE id = $1',
    [eventId]
  );

  if (!event) {
    notFound();
  }

  // Fetch RSVP fields for this event
  const rsvpFields = await query<RSVPField>(
    'SELECT * FROM rsvp_fields WHERE event_id = $1 ORDER BY sort_order ASC',
    [eventId]
  );

  // Transform the event into the wizard form data shape
  const builderData = fromEvent(event, rsvpFields);
  const initialData = {
    ...builderData,
    customization: {
      ...builderData.customization,
      backgroundImage: builderData.customization.backgroundImage ?? '',
      audioUrl: builderData.customization.audioUrl ?? '',
      logoUrl: builderData.customization.logoUrl ?? '',
    },
    reminder_sequence: event.reminder_sequence ?? [],
    ai_generation_id: event.ai_generation_id ?? '',
  };

  return (
    <div className="py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="mb-8 text-2xl font-bold text-gray-900">Edit Event</h1>
        <WizardContainer
          mode="edit"
          eventId={eventId}
          initialData={initialData}
        />
      </div>
    </div>
  );
}
