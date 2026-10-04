import { getCurrentUser } from '@/lib/auth/session';
import { getEventsByUser, getInvitedEvents, getCollaboratingEvents } from '@/lib/events';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { EventActionsMenu } from '@/components/dashboard/EventActionsMenu';
import { UsageStats } from '@/components/dashboard/UsageStats';
import { UpgradeSuccessToast } from '@/components/events/UpgradeSuccessToast';
import { EventSearchFilter } from '@/components/dashboard/EventSearchFilter';
import { getUserTier } from '@/lib/subscription';
import { BetaFeedback } from '@/components/dashboard/BetaFeedback';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { WelcomeTour } from '@/components/onboarding/WelcomeTour';
import { queryOne } from '@/lib/db/client';
import { BETA_MODE } from '@/lib/constants';
import { SealMark } from '@/components/layout/Logo';
import { Calendar, CalendarCheck, MapPin, Plus, Users } from 'lucide-react';

interface DashboardPageProps {
  searchParams: Promise<{ upgraded?: string; plan?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { upgraded, plan } = await searchParams;
  const user = await getCurrentUser();
  
  // Redirect to login if no user
  if (!user) {
    redirect('/login?redirect=/dashboard');
  }
  
  // Optimized: Using Promise.all to fetch events in parallel reduces TTFB.
  // Passing both email and phone to getInvitedEvents for accurate guest lookup.
  const [myEvents, collaboratingEvents, invitedEvents, accountPlan] = await Promise.all([
    getEventsByUser(user.id),
    getCollaboratingEvents(user.id),
    getInvitedEvents(user.email, user.phone),
    getUserTier(user.id),
  ]);
  
  const allEvents = Array.from(new Map([...myEvents, ...collaboratingEvents, ...invitedEvents].map((event) => [event.id, event])).values());
  const activeOwnedEvents = myEvents.filter((event) => event.status !== 'archived');
  const firstOwnedEvent = activeOwnedEvents[0];
  const [onboarding, guestUsage] = await Promise.all([
    firstOwnedEvent ? queryOne<{ guest_count: string; sent_count: string }>(
      `SELECT COUNT(*)::text AS guest_count,
              COUNT(*) FILTER (WHERE invite_status IN ('sent','delivered','accepted'))::text AS sent_count
         FROM guests WHERE event_id = $1`,
      [firstOwnedEvent.id],
    ) : null,
    queryOne<{ largest_event_guest_count: string }>(
      `SELECT COALESCE(MAX(event_guest_count), 0)::text AS largest_event_guest_count
         FROM (
           SELECT COUNT(guests.id) AS event_guest_count
             FROM events
             LEFT JOIN guests ON guests.event_id = events.id
            WHERE events.user_id = $1 AND events.status <> 'archived'
            GROUP BY events.id
         ) active_event_usage`,
      [user.id],
    ),
  ]);

  return (
    <div className="min-h-screen bg-cotton">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!BETA_MODE && plan && (
          <div className="mb-6 rounded-2xl border border-border bg-white p-5 text-ink">
            <p className="font-semibold">Continue with {plan === 'pro_annual' ? 'SealSend Pro' : plan === 'event_pass' ? 'Event Pass' : `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`}</p>
            <p className="mt-1 text-sm text-neutral-600">
              {plan === 'pro_annual'
                ? 'Review the annual plan and continue to secure Stripe checkout.'
                : 'Create your event first, then apply this one-time event upgrade.'}
            </p>
            <Link href={plan === 'pro_annual' ? '/pricing' : `/events/new?plan=${encodeURIComponent(plan)}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-input bg-white px-4 text-sm font-medium text-ink hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
              {plan === 'pro_annual' ? 'Continue to Pro checkout' : 'Create your event'}
            </Link>
          </div>
        )}
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-4xl text-ink">Dashboard</h1>
              <p className="mt-2 truncate text-neutral-600">
                Welcome back, {user?.email || user?.phone || 'User'}
              </p>
            </div>
            {allEvents.length > 0 && (
              <Link
                href="/events/new"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                <Plus className="h-5 w-5" aria-hidden />
                Create event
              </Link>
            )}
          </div>
        </div>

        <WelcomeTour userId={user.id} show={user.role === 'admin' && myEvents.length === 0 && collaboratingEvents.length === 0} />
        <OnboardingChecklist
          event={firstOwnedEvent ? {
            id: firstOwnedEvent.id,
            eventDate: firstOwnedEvent.event_date,
            locationName: firstOwnedEvent.location_name,
            maxAttendees: firstOwnedEvent.max_attendees,
            invitationHeadline: firstOwnedEvent.invitation_headline,
            invitationBody: firstOwnedEvent.invitation_body,
            status: firstOwnedEvent.status,
          } : null}
          hasGuest={Number(onboarding?.guest_count ?? 0) > 0}
          hasInvitation={Number(onboarding?.sent_count ?? 0) > 0}
        />

        {/* Usage Stats */}
        <div className="mb-8">
          <UsageStats
            tier={accountPlan === 'pro_annual' ? 'SealSend Pro' : accountPlan === 'beta' ? 'Controlled Beta' : 'free'}
            eventsUsed={activeOwnedEvents.length}
            eventsLimit={accountPlan === 'pro_annual' ? -1 : 1}
            guestsUsed={Number(guestUsage?.largest_event_guest_count ?? 0)}
            guestsLimit={accountPlan === 'beta' ? 100 : accountPlan === 'pro_annual' ? 2500 : 15}
          />
        </div>

        {/* Stats */}
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
          {[
            { label: 'My events', value: myEvents.length, Icon: Calendar },
            { label: 'Invited to', value: invitedEvents.length, Icon: Users },
            { label: 'Total events', value: allEvents.length, Icon: CalendarCheck },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5">
              <Icon className="h-5 w-5 shrink-0 text-neutral-500" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0 flex-1">
                <dt className="truncate text-sm font-medium text-neutral-600">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums text-ink">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        {/* My Events Section */}
        {myEvents.length > 0 && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-white">
            <div className="border-b border-border px-4 py-5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">My events</h2>
                  <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                    Events you created and manage
                  </p>
                </div>
                {myEvents.length > 3 && <EventSearchFilter />}
              </div>
            </div>
            <ul className="divide-y divide-border" id="my-events-list">
              {myEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between hover:bg-neutral-50">
                  <Link href={`/events/${event.id}`} className="block flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <p className="truncate text-sm font-semibold text-ink">
                              {event.title}
                            </p>
                            <span className="ml-2 inline-flex items-center rounded-md border border-border bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
                              Owner
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                            <div className="flex items-center text-sm text-neutral-600">
                              <Calendar className="mr-1.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                              <span>
                                {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'No date set'}
                              </span>
                            </div>
                            <div className="flex min-w-0 items-center text-sm text-neutral-600">
                              <MapPin className="mr-1.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                              <span className="truncate">{event.location_name || 'No location'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            event.status === 'published'
                              ? 'bg-success-50 text-success-700'
                              : event.status === 'draft'
                              ? 'bg-warning-50 text-neutral-700 ring-1 ring-inset ring-warning-500/40'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}>
                            {event.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="px-4 py-4 sm:px-2">
                    <EventActionsMenu
                      eventId={event.id}
                      eventTitle={event.title}
                      eventTimezone={event.event_timezone}
                      eventStatus={event.status}
                      canKeepCurrentActive={accountPlan === 'pro_annual'}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Invited Events Section */}
        {invitedEvents.length > 0 && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-white">
            <div className="border-b border-border px-4 py-5 sm:px-6">
              <h2 className="text-lg font-semibold text-ink">Events I&apos;m invited to</h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                Events you&apos;ve been invited to as a guest
              </p>
            </div>
            <ul className="divide-y divide-border">
              {invitedEvents.map((event) => (
                <li key={event.id}>
                  <Link href={`/events/${event.id}/guest`} className="block hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <p className="truncate text-sm font-semibold text-ink">
                              {event.title}
                            </p>
                            <span className="ml-2 inline-flex items-center rounded-md bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
                              Invited
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                            <div className="flex items-center text-sm text-neutral-600">
                              <Calendar className="mr-1.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                              <span>
                                {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'No date set'}
                              </span>
                            </div>
                            <div className="flex min-w-0 items-center text-sm text-neutral-600">
                              <MapPin className="mr-1.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                              <span className="truncate">{event.location_name || 'No location'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span className="inline-flex items-center rounded-full border border-border bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                            Guest view
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Empty State */}
        {allEvents.length === 0 && (
          <div className="mb-8 rounded-2xl border border-border bg-white px-6 py-14 text-center">
            <SealMark className="mx-auto h-16 w-16" />
            <h2 className="mt-5 text-lg font-semibold text-ink">No events yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              Create your first event to write the invitation, add guests and track every reply in one place.
            </p>
            <div className="mt-6">
              <Link
                href="/events/new"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                <Plus className="h-5 w-5" aria-hidden />
                Create event
              </Link>
            </div>
          </div>
        )}
        <BetaFeedback />
        {upgraded === 'true' && <UpgradeSuccessToast />}
      </div>
    </div>
  );
}
