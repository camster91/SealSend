import type { Metadata } from 'next';
import WizardContainer from '@/components/events/wizard/WizardContainer';
import { getEventTemplate } from '@/lib/event-templates';
import { getCurrentUser } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/client';

export const metadata: Metadata = {
  title: 'Create Event',
};

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ template?: string; workspace?: string }> }) {
  const { template: templateId, workspace } = await searchParams;
  const template = getEventTemplate(templateId);
  // Only offer a team workspace the host can create events in (owner, admin or planner).
  const user = workspace && /^[0-9a-f-]{36}$/i.test(workspace) ? await getCurrentUser() : null;
  const organization = user ? await queryOne<{ id: string; name: string }>(
    `SELECT o.id, o.name FROM organization_members m JOIN organizations o ON o.id = m.organization_id
      WHERE m.organization_id = $1 AND m.user_id = $2 AND m.role IN ('owner', 'admin', 'planner') AND NOT o.is_personal`,
    [workspace, user.id],
  ) : null;
  return (
    <div className="py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Create New Event</h1>
        {organization && <p className="mb-2 text-sm text-gray-600">Creating in the <strong>{organization.name}</strong> workspace.</p>}
        {template && <p className="mb-8 text-sm text-gray-600">Starting with <strong>{template.name}</strong>. You can change every setting.</p>}
        {!template && <div className="mb-8"><a href="/templates" className="text-sm font-semibold text-brand-700 hover:underline">Browse visual templates</a></div>}
        <WizardContainer mode="create" initialData={template ? { customization: template.customization } : undefined} draftKey={template?.id} organizationId={organization?.id} />
      </div>
    </div>
  );
}
