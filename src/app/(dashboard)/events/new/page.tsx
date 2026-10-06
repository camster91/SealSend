import type { Metadata } from 'next';
import { StartScreen } from '@/components/events/builder/StartScreen';
import { getEventTemplate } from '@/lib/event-templates';
import { getCurrentUser } from '@/lib/auth/session';
import { query, queryOne } from '@/lib/db/client';
import { canCreateEvent } from '@/lib/entitlements';
import { getUserTier } from '@/lib/subscription';
import { decideStart, type OpenEvent } from '@/lib/event-builder/start-decision';

export const metadata: Metadata = {
  title: 'Create Event',
};

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ template?: string; workspace?: string }> }) {
  const { template: templateId, workspace } = await searchParams;
  const template = getEventTemplate(templateId);
  const user = await getCurrentUser();
  // Only offer a team workspace the host can create events in (owner, admin or planner).
  const organization = user && workspace && /^[0-9a-f-]{36}$/i.test(workspace) ? await queryOne<{ id: string; name: string }>(
    `SELECT o.id, o.name FROM organization_members m JOIN organizations o ON o.id = m.organization_id
      WHERE m.organization_id = $1 AND m.user_id = $2 AND m.role IN ('owner', 'admin', 'planner') AND NOT o.is_personal`,
    [workspace, user.id],
  ) : null;

  // Same rule POST /api/events enforces: the user's events that are not archived.
  let openEvents: OpenEvent[] = [];
  let canCreate = true;
  if (user) {
    openEvents = await query<OpenEvent>(
      "SELECT id, status, title FROM events WHERE user_id = $1 AND status <> 'archived' ORDER BY created_at DESC",
      [user.id],
    );
    canCreate = canCreateEvent(await getUserTier(user.id), openEvents.length);
  }
  const decision = decideStart(openEvents, canCreate);

  return (
    <div className="py-8">
      <div className="mx-auto max-w-6xl">
        <StartScreen decision={decision} template={template} organization={organization ?? undefined} />
      </div>
    </div>
  );
}
