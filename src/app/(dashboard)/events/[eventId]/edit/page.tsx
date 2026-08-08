import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { query, queryOne } from '@/lib/db/client';
import WizardContainer from '@/components/events/wizard/WizardContainer';
import type { Event, RSVPField } from '@/types/database';
import type { Metadata } from 'next';
import { getEventAccess, roleCan } from '@/lib/auth/event-access';

export const metadata: Metadata = {
  title: 'Edit Event',
};

interface EditEventPageProps {
  params: Promise<{ eventId: string }>;
}

function toDateTimeLocal(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
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

  // Transform the event data into wizard form data shape
  const initialData = {
    title: event.title ?? '',
    description: event.description ?? '',
    event_date: event.event_date
      ? toDateTimeLocal(event.event_date, event.event_timezone || 'UTC')
      : '',
    event_end_date: event.event_end_date
      ? toDateTimeLocal(event.event_end_date, event.event_timezone || 'UTC')
      : '',
    event_timezone: event.event_timezone || 'UTC',
    location_name: event.location_name ?? '',
    location_address: event.location_address ?? '',
    host_name: event.host_name ?? '',
    dress_code: event.dress_code ?? '',
    rsvp_deadline: event.rsvp_deadline
      ? toDateTimeLocal(event.rsvp_deadline, event.event_timezone || 'UTC')
      : '',
    registry_links: event.registry_links ?? [],
    max_attendees: event.max_attendees,
    allow_plus_ones: event.allow_plus_ones,
    max_guests_per_rsvp: event.max_guests_per_rsvp,
    design_url: event.design_url ?? '',
    design_type: event.design_type ?? 'upload',
    invitation_headline: event.invitation_headline ?? '',
    invitation_body: event.invitation_body ?? '',
    reminder_sequence: event.reminder_sequence ?? [],
    ai_generation_id: event.ai_generation_id ?? '',
    customization: {
      primaryColor: event.customization?.primaryColor ?? '#6366f1',
      backgroundColor: event.customization?.backgroundColor ?? '#ffffff',
      backgroundImage: event.customization?.backgroundImage ?? '',
      fontFamily: event.customization?.fontFamily ?? 'Inter',
      buttonStyle: event.customization?.buttonStyle ?? 'rounded',
      showCountdown: event.customization?.showCountdown ?? true,
      audioUrl: event.customization?.audioUrl ?? '',
      logoUrl: event.customization?.logoUrl ?? '',
    },
    rsvp_fields: (rsvpFields ?? []).map((f) => ({
      field_name: f.field_name,
      field_type: f.field_type,
      field_label: f.field_label,
      is_required: f.is_required,
      is_enabled: f.is_enabled,
      options: f.options ?? null,
      placeholder: f.placeholder ?? null,
    })),
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
