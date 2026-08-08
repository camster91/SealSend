import type { Metadata } from 'next';
import WizardContainer from '@/components/events/wizard/WizardContainer';
import { getEventTemplate } from '@/lib/event-templates';

export const metadata: Metadata = {
  title: 'Create Event',
};

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template: templateId } = await searchParams;
  const template = getEventTemplate(templateId);
  return (
    <div className="py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Create New Event</h1>
        {template && <p className="mb-8 text-sm text-gray-600">Starting with <strong>{template.name}</strong>. You can change every setting.</p>}
        {!template && <div className="mb-8"><a href="/templates" className="text-sm font-semibold text-brand-700 hover:underline">Browse visual templates</a></div>}
        <WizardContainer mode="create" initialData={template ? { customization: template.customization } : undefined} draftKey={template?.id} />
      </div>
    </div>
  );
}
