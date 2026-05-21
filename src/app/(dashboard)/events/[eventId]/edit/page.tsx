import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import WizardContainer from '@/components/events/wizard/WizardContainer';
import type { Event, RSVPField } from '@/types/database';
import type { Metadata } from 'next';

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

  // Fetch the event
  const event = await prisma.event.findFirst({
    where: { id: eventId, user_id: user.id },
  });

  if (!event) {
    notFound();
  }

  // Fetch RSVP fields for this event
  const rsvpFields = await prisma.rsvpField.findMany({
    where: { event_id: eventId },
    orderBy: { sort_order: 'asc' },
  });

  // Transform the event data into wizard form data shape
  const initialData = {
    title: event.title ?? '',
    description: event.description ?? '',
    event_date: event.event_date
      ? new Date(event.event_date).toISOString().slice(0, 16)
      : '',
    event_end_date: event.event_end_date
      ? new Date(event.event_end_date).toISOString().slice(0, 16)
      : '',
    location_name: event.location_name ?? '',
    location_address: event.location_address ?? '',
    design_url: event.design_url ?? '',
    design_type: event.design_type ?? 'upload',
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
