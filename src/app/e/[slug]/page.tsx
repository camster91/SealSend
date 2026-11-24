import { query, queryOne } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { EventHero } from "@/components/public-event/EventHero";
import { EventDetails } from "@/components/public-event/EventDetails";
import { RSVPForm } from "@/components/public-event/RSVPForm";
import Link from "next/link";
import { CommentsSection } from "@/components/public-event/CommentsSection";
import { GuestSocial } from '@/components/social/GuestSocial';
import { SignupBoard } from "@/components/public-event/SignupBoard";
import { AudioPlayer } from "@/components/public-event/AudioPlayer";
import { AnimatedEventLayout, AnimatedSection } from "@/components/public-event/AnimatedEventLayout";
import {
  sanitizeCustomization,
  sanitizeInviteToken,
} from "@/lib/sanitize";
import type { Event, RSVPField } from "@/types/database";
import { getUserTier } from "@/lib/subscription";
import { showsPoweredByBadge } from "@/lib/entitlements";
import { getEventBranding, mergeBrandIntoCustomization } from "@/lib/brands";
import type { Metadata } from "next";
import { eventFontFamily } from '@/lib/event-font';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await queryOne<{ title: string; description: string | null; design_url: string | null }>(
    'SELECT title, description, design_url FROM events WHERE slug = $1 AND status = $2',
    [slug, 'published']
  );

  if (!event) return { title: "Event Not Found" };

  return {
    title: event.title,
    description: event.description || `RSVP to ${event.title}`,
    openGraph: {
      title: event.title,
      description: event.description || `RSVP to ${event.title}`,
      images: event.design_url ? [event.design_url] : [],
    },
  };
}

export default async function PublicEventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  const event = await queryOne<Event>(
    'SELECT * FROM events WHERE slug = $1 AND status = $2',
    [slug, 'published']
  );

  if (!event) notFound();

  const rsvpFields = await query<RSVPField>(
    'SELECT * FROM rsvp_fields WHERE event_id = $1 ORDER BY sort_order ASC',
    [event.id]
  );
  // Workspace brand fills any look the event itself left unset; a
  // white-labelled organizer brand also removes the SealSend badge.
  const branding = await getEventBranding(event.id as string);
  event.customization = mergeBrandIntoCustomization(
    event.customization as unknown as Record<string, unknown>,
    branding,
  ) as unknown as typeof event.customization;
  const showBadge = !branding?.whiteLabel
    && showsPoweredByBadge(await getUserTier(event.user_id as string), event.tier as string);

  // Calculate spots remaining for guest limits
  let spotsRemaining: number | null = null;
  const maxAttendees = (event.max_attendees as number) || null;
  if (maxAttendees) {
    const sumResult = await queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(headcount), 0) AS total
       FROM rsvp_responses WHERE event_id = $1 AND status = $2`,
      [event.id, 'attending']
    );
    const currentTotal = Number(sumResult?.total ?? 0);
    spotsRemaining = Math.max(0, maxAttendees - currentTotal);
  }

  // Resolve invite token for magic link pre-filling
  let inviteGuest: { id: string; name: string; email: string | null } | null = null;
  const rawToken = typeof resolvedSearchParams.t === "string" ? resolvedSearchParams.t : null;
  const token = sanitizeInviteToken(rawToken);

  if (token) {
    const guest = await queryOne<{ id: string; name: string; email: string | null }>(
      'SELECT id, name, email FROM guests WHERE invite_token = $1 AND event_id = $2',
      [token, event.id]
    );
    if (guest) inviteGuest = guest;
  }
  const unknownLink = rawToken !== null && !inviteGuest;

  // Sanitize all customization values
  const customization = sanitizeCustomization(event.customization as unknown as Record<string, unknown>);
  const safeBgColor = customization.backgroundColor;
  const safePrimaryColor = customization.primaryColor;
  const fontFamily = eventFontFamily(customization.fontFamily);
  const backgroundImage = customization.backgroundImage;
  const audioUrl = customization.audioUrl;
  const buttonStyle = customization.buttonStyle;

  // backgroundImage is already sanitized by sanitizeCustomization (HTTPS-only, no special chars)
  const pageStyle: React.CSSProperties = {
    backgroundColor: safeBgColor,
    fontFamily,
    ...(backgroundImage && {
      backgroundImage: `url("${encodeURI(backgroundImage)}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    }),
  };

  return (
    <div className="min-h-screen pb-12 overflow-x-hidden" style={pageStyle}>
      <AnimatedEventLayout>
        {/* Hero — full width */}
        <AnimatedSection className="mx-auto max-w-4xl px-4 pt-8 md:pt-12">
          <EventHero event={event} />
        </AnimatedSection>

        {/* One column on phones: details, reply, then everything else */}
        <div className="mx-auto max-w-4xl px-4 py-6">
          {unknownLink && (
            <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              We didn&apos;t recognize your personal link, so your reply won&apos;t be matched to your invitation. You can still reply below, or ask your host for a new link.
            </p>
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:items-start">
            <AnimatedSection className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6 lg:col-span-3">
              <EventDetails event={event} showTitle={Boolean(event.design_url)} />
            </AnimatedSection>

            <AnimatedSection className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-8 lg:col-span-2 lg:row-span-2">
                <RSVPForm
                  eventSlug={slug}
                  fields={rsvpFields || []}
                  primaryColor={safePrimaryColor}
                  buttonStyle={buttonStyle}
                  allowPlusOnes={event.allow_plus_ones !== undefined ? (event.allow_plus_ones as boolean) : true}
                  maxGuestsPerRsvp={(event.max_guests_per_rsvp as number) || 10}
                  spotsRemaining={spotsRemaining}
                  inviteToken={inviteGuest && token ? token : undefined}
                  inviteGuestId={inviteGuest?.id}
                  inviteGuestName={inviteGuest?.name}
                  inviteGuestEmail={inviteGuest?.email}
                />
            </AnimatedSection>

            <div className="space-y-6 lg:col-span-3">
              <AnimatedSection>
                <SignupBoard eventSlug={slug} />
              </AnimatedSection>
              <AnimatedSection>
                <GuestSocial slug={slug} token={inviteGuest && token ? token : undefined} />
              </AnimatedSection>
              <AnimatedSection>
                <CommentsSection eventSlug={slug} />
              </AnimatedSection>
            </div>
          </div>
        </div>

        <footer className="px-4 pb-8 text-center">
          <nav aria-label="Help and privacy" className="inline-flex flex-wrap items-center justify-center gap-x-5 rounded-full bg-white px-5 text-sm text-ink shadow-sm">
            {showBadge && <Link href="/" className="inline-flex min-h-11 items-center">Powered by SealSend</Link>}
            <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-4">Privacy</Link>
            <Link href="/support" className="inline-flex min-h-11 items-center underline underline-offset-4">Help</Link>
          </nav>
        </footer>
      </AnimatedEventLayout>

      {/* Audio player */}
      {audioUrl && <AudioPlayer audioUrl={audioUrl} />}
    </div>
  );
}
