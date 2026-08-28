import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/client';
import type { Event } from '@/types/database';
import { AnnouncementSection } from '@/components/dashboard/AnnouncementSection';
import { DeleteEventButton } from '@/components/dashboard/DeleteEventButton';
import { CopyLinkButton } from '@/components/dashboard/CopyLinkButton';
import { CloneEventButton } from '@/components/dashboard/CloneEventButton';
import { UpgradeButton } from '@/components/events/UpgradeButton';
import { UpgradeSuccessToast } from '@/components/events/UpgradeSuccessToast';
import { ExportTools } from '@/components/dashboard/ExportTools';
import { AutoRemindersToggle } from '@/components/dashboard/AutoRemindersToggle';
import { canUseFeature, type EventTier } from '@/lib/entitlements';
import { getUserTier } from '@/lib/subscription';
import { getEventAccess, roleCan } from '@/lib/auth/event-access';
import { EventTeamPanel } from '@/components/dashboard/EventTeamPanel';
import { PublishEventButton } from '@/components/dashboard/PublishEventButton';

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ upgraded?: string }>;
}

export default async function EventDetailPage({ params, searchParams }: EventDetailPageProps) {
  const { eventId } = await params;
  const { upgraded } = await searchParams;

  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const access = await getEventAccess(user.id, eventId);
  if (!access || !roleCan(access.role, 'view_event')) notFound();

  // Optimized: Consolidating three database queries into one using scalar subqueries.
  // This reduces database round-trips from 3 to 1, significantly improving TTFB.
  const event = await queryOne<Event & { response_count: number; guest_count: number; repeated_from_title: string | null }>(
    `SELECT *,
      (SELECT COUNT(*)::int FROM rsvp_responses WHERE event_id = events.id) AS response_count,
      (SELECT COUNT(*)::int FROM guests WHERE event_id = events.id) AS guest_count,
      (SELECT source.title FROM events source
        WHERE source.id = events.repeated_from_event_id AND source.user_id = events.user_id) AS repeated_from_title
     FROM events
     WHERE id = $1`,
    [eventId]
  );

  if (!event) {
    notFound();
  }

  const responseCount = event.response_count ?? 0;
  const guestCount = event.guest_count ?? 0;

  const isPublished = event.status === 'published';
  const isArchived = event.status === 'archived';
  const statusLabel = isPublished ? 'Published' : isArchived ? 'Archived' : 'Draft';
  const statusClass = isPublished
    ? 'bg-green-500/90 text-white'
    : isArchived
      ? 'bg-slate-700/90 text-white'
      : 'bg-amber-500/90 text-white';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sealsend.app';
  const publicUrl = `${siteUrl}/e/${event.slug}`;
  const accountPlan = await getUserTier(event.user_id as string);
  const canSendAnnouncements = canUseFeature(accountPlan, event.tier as EventTier, 'announcements');
  const canEdit = roleCan(access.role, 'edit_event');
  const canManageGuests = roleCan(access.role, 'manage_guests');
  const canExport = roleCan(access.role, 'export_responses');
  const canManageMembers = roleCan(access.role, 'manage_members');

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="py-6">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>

        {/* Hero header */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Design preview strip */}
          {event.design_url ? (
            <div className="relative h-48 sm:h-56">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.design_url as string}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${statusClass}`}
                    >
                      {statusLabel}
                    </span>
                    <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{event.title as string}</h1>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-500 p-6 sm:p-8">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}
              >
                {statusLabel}
              </span>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{event.title as string}</h1>
              {event.description && (
                <p className="mt-2 max-w-xl text-sm text-white/80">{event.description as string}</p>
              )}
            </div>
          )}

          {/* Tier + Upgrade */}
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              ['gold', 'premium'].includes(event.tier as string)
                ? 'bg-amber-100 text-amber-700'
                : ['platinum'].includes(event.tier as string)
                  ? 'bg-slate-100 text-slate-700'
                  : ['diamond'].includes(event.tier as string)
                    ? 'bg-indigo-100 text-indigo-700'
                    : ['silver', 'standard'].includes(event.tier as string)
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-gray-100 text-gray-600'
            }`}>
              {(event.tier as string).charAt(0).toUpperCase() + (event.tier as string).slice(1)} tier
            </span>
            {access.role === 'owner' && !isArchived && <UpgradeButton eventId={eventId} currentTier={event.tier as string} />}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2 border-t border-gray-100 p-4 sm:flex sm:gap-2">
            {!isArchived && canEdit && <ActionLink href={`/events/${eventId}/edit`} icon="edit" label="Edit" />}
            {canExport && <ActionLink href={`/events/${eventId}/responses`} icon="responses" label="Responses" count={responseCount} />}
            {canManageGuests && <ActionLink href={`/events/${eventId}/guests`} icon="guests" label="Guests" count={guestCount} />}
            {canManageGuests && <ActionLink href={`/events/${eventId}/signups`} icon="signups" label="Sign-ups" />}
            <ActionLink href={`/events/${eventId}/comments`} icon="comments" label="Comments" />
            {canExport && <ActionLink href={`/events/${eventId}/analytics`} icon="analytics" label="Analytics" />}
            {roleCan(access.role, 'check_in_guests') && <ActionLink href={`/events/${eventId}/check-in`} icon="checkin" label="Check-in" />}
          </div>
        </div>

        {/* Stats + Details grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Stats */}
          <div className="space-y-4 lg:col-span-1">
            <StatBlock
              value={responseCount}
              label="Responses"
              color="from-blue-500 to-indigo-600"
              icon="responses"
            />
            <StatBlock
              value={guestCount}
              label="Guests"
              color="from-emerald-500 to-teal-600"
              icon="guests"
            />

            {/* Public link */}
            {isPublished && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Public Link</p>
                <div className="mt-2 flex items-center gap-2">
                  <Link
                    href={publicUrl}
                    target="_blank"
                    className="min-w-0 flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 text-sm font-mono text-brand-600 hover:text-brand-700 hover:underline"
                  >
                    /e/{event.slug as string}
                  </Link>
                  <CopyLinkButton url={publicUrl} />
                </div>
                <a
                  href={`/api/events/${eventId}/qr`}
                  download={`${event.slug}-qr.png`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-[0.98]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h4v4H3V4zm0 8h4v4H3v-4zm8-8h4v4h-4V4zm8 0h4v4h-4V4zm0 8h4v4h-4v-4zm-8 8h4v4h-4v-4z" />
                  </svg>
                  Download QR Code
                </a>
              </div>
            )}

            {/* Auto Reminders */}
            {!isArchived && roleCan(access.role, 'send_messages') && <AutoRemindersToggle
              eventId={eventId}
              initialEnabled={!!event.auto_reminders}
              eventDate={event.event_date as string | null}
              isPublished={isPublished}
            />}

            {/* Publish / delete / clone */}
            <div className="space-y-2">
              {isArchived && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Archived event history</p>
                  <p className="mt-1">This event cannot be republished directly. Use Repeat event to create a reviewed new draft.</p>
                </div>
              )}
              {!isArchived && canEdit && <PublishEventButton eventId={eventId} isPublished={isPublished} />}
              {access.role === 'owner' && <CloneEventButton
                eventId={eventId}
                eventTitle={event.title as string}
                eventTimezone={event.event_timezone}
                eventStatus={event.status}
                canKeepCurrentActive={accountPlan === 'pro_annual'}
              />}
              {access.role === 'owner' && <DeleteEventButton eventId={eventId} eventTitle={event.title as string} />}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50/50 px-6 py-3.5">
                <h2 className="text-sm font-semibold text-gray-900">Event Details</h2>
              </div>
              <div className="divide-y divide-gray-50 p-1">
                {access.role === 'owner' && event.repeated_from_event_id && event.repeated_from_title && (
                  <div className="flex items-start gap-3 rounded-xl px-5 py-3 transition-colors hover:bg-gray-50/50">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500" aria-hidden="true">↩</div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Previous event</p>
                      <Link href={`/events/${event.repeated_from_event_id}`} className="mt-0.5 block truncate text-sm font-medium text-brand-700 hover:underline">
                        {event.repeated_from_title}
                      </Link>
                    </div>
                  </div>
                )}
                <DetailRow icon="calendar" label="Date" value={formatDate(event.event_date as string | null)} />
                {event.event_end_date && (
                  <DetailRow icon="calendar-end" label="End Date" value={formatDate(event.event_end_date as string | null)} />
                )}
                <DetailRow icon="location" label="Venue" value={event.location_name as string | null} subtitle={event.location_address as string | null} />
                <DetailRow icon="host" label="Hosted By" value={event.host_name as string | null} />
                <DetailRow icon="dress" label="Dress Code" value={event.dress_code as string | null} />
                <DetailRow icon="deadline" label="RSVP Deadline" value={formatDate(event.rsvp_deadline as string | null)} />
                <DetailRow icon="capacity" label="Max Attendees" value={event.max_attendees ? `${event.max_attendees}` : null} />
                <DetailRow icon="capacity" label="Max per RSVP" value={event.max_guests_per_rsvp ? `${event.max_guests_per_rsvp}` : null} />
                <DetailRow icon="capacity" label="+1s Allowed" value={event.allow_plus_ones === false ? 'No' : event.allow_plus_ones === true ? 'Yes' : null} />
                <DetailRow icon="slug" label="Slug" value={event.slug as string | null} mono />
                <DetailRow
                  icon="created"
                  label="Created"
                  value={new Date(event.created_at as string).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                />
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">Description</h2>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{event.description as string}</p>
              </div>
            )}
          </div>
        </div>

        {/* Marketing Tools */}
        {canExport && <div className="mt-6">
          <ExportTools
            eventTitle={event.title as string}
            eventDate={event.event_date as string}
            eventLocation={event.location_name as string}
            eventSlug={event.slug as string}
            designUrl={event.design_url as string}
          />
        </div>}

        {/* Announcements */}
        {isPublished && roleCan(access.role, 'send_messages') && (
          <div className="mt-6">
            <AnnouncementSection eventId={eventId} hasAccess={canSendAnnouncements} />
          </div>
        )}

        {canManageMembers && <EventTeamPanel eventId={eventId} />}

        {upgraded === 'true' && <UpgradeSuccessToast />}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────

function ActionLink({ href, icon, label, count }: { href: string; icon: string; label: string; count?: number }) {
  const icons: Record<string, React.ReactNode> = {
    edit: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>,
    responses: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>,
    guests: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    signups: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>,
    comments: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>,
    analytics: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
    checkin: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>,
  };

  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-[0.98] sm:py-2.5"
    >
      {icons[icon]}
      {label}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">{count}</span>
      )}
    </Link>
  );
}

function StatBlock({ value, label, color, icon }: { value: number; label: string; color: string; icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    responses: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>,
    guests: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-sm`}>
          {icons[icon]}
        </div>
        <div>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className="text-sm font-medium text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, subtitle, mono }: { icon: string; label: string; value: string | null | undefined; subtitle?: string | null; mono?: boolean }) {
  if (!value) return null;

  const iconMap: Record<string, React.ReactNode> = {
    calendar: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
    'calendar-end': <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    location: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
    host: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
    dress: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>,
    deadline: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" /></svg>,
    capacity: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>,
    slug: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.886-3.497l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" /></svg>,
    created: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  };

  return (
    <div className="flex items-start gap-3 rounded-xl px-5 py-3 transition-colors hover:bg-gray-50/50">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        {iconMap[icon]}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={`mt-0.5 text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}
