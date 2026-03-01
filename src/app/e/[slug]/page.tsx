import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { EventHero } from "@/components/public-event/EventHero";
import { EventDetails } from "@/components/public-event/EventDetails";
import { RSVPForm } from "@/components/public-event/RSVPForm";
import { LocationMap } from "@/components/public-event/LocationMap";
import { CommentsSection } from "@/components/public-event/CommentsSection";
import { SignupBoard } from "@/components/public-event/SignupBoard";
import { ConfettiEffect } from "@/components/public-event/ConfettiEffect";
import { AudioPlayer } from "@/components/public-event/AudioPlayer";
import { AnimatedEventLayout, AnimatedSection } from "@/components/public-event/AnimatedEventLayout";
import { 
  sanitizeCustomization, 
  sanitizeInviteToken,
  sanitizeColor,
  sanitizeFontFamily,
  sanitizeBackgroundImage,
  sanitizeAudioUrl,
  sanitizeButtonStyle
} from "@/lib/sanitize";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, description, design_url")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

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
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!event) notFound();

  const { data: rsvpFields } = await supabase
    .from("rsvp_fields")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order", { ascending: true });

  // Calculate spots remaining for guest limits
  let spotsRemaining: number | null = null;
  const maxAttendees = event.max_attendees || null;
  if (maxAttendees) {
    const { data: attendingResponses } = await supabase
      .from("rsvp_responses")
      .select("headcount")
      .eq("event_id", event.id)
      .eq("status", "attending");

    const currentTotal = (attendingResponses || []).reduce(
      (sum: number, r: { headcount: number }) => sum + (r.headcount || 1),
      0
    );
    spotsRemaining = Math.max(0, maxAttendees - currentTotal);
  }

  // Resolve invite token for magic link pre-filling
  let inviteGuest: { id: string; name: string; email: string | null } | null = null;
  const rawToken = typeof resolvedSearchParams.t === "string" ? resolvedSearchParams.t : null;
  const token = sanitizeInviteToken(rawToken);
  
  if (token) {
    const { data: guest } = await supabase
      .from("guests")
      .select("id, name, email")
      .eq("invite_token", token)
      .eq("event_id", event.id)
      .single();
    if (guest) inviteGuest = guest;
  }

  // Sanitize all customization values
  const customization = sanitizeCustomization(event.customization);
  const safeBgColor = customization.backgroundColor;
  const safePrimaryColor = customization.primaryColor;
  const fontFamily = customization.fontFamily;
  const backgroundImage = customization.backgroundImage;
  const audioUrl = customization.audioUrl;
  const buttonStyle = customization.buttonStyle;

  const pageStyle: React.CSSProperties = {
    backgroundColor: safeBgColor,
    fontFamily,
    ...(backgroundImage && {
      backgroundImage: `url(${encodeURI(backgroundImage)})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    }),
  };

  return (
    <div className="min-h-screen pb-12 overflow-x-hidden" style={pageStyle}>
      <ConfettiEffect />

      <AnimatedEventLayout>
        {/* Hero — full width */}
        <AnimatedSection className="mx-auto max-w-4xl px-4 pt-8 md:pt-12">
          <EventHero event={event} />
        </AnimatedSection>

        {/* Two-column layout on desktop */}
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* Left column: Details + Map */}
            <div className="space-y-8 lg:col-span-3">
              <AnimatedSection className="rounded-xl border border-border bg-white/95 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-md">
                <EventDetails event={event} />
              </AnimatedSection>

              {event.location_address && (
                <AnimatedSection>
                  <LocationMap
                    address={event.location_address}
                    name={event.location_name || undefined}
                  />
                </AnimatedSection>
              )}

              {/* Sign-up board */}
              <AnimatedSection>
                <SignupBoard eventSlug={slug} />
              </AnimatedSection>

              {/* Comments / Message Board */}
              <AnimatedSection>
                <CommentsSection eventSlug={slug} />
              </AnimatedSection>
            </div>

            {/* Right column: RSVP Form */}
            <div className="lg:col-span-2">
              <AnimatedSection className="sticky top-8 rounded-xl border border-border bg-white/95 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-md">
                <RSVPForm
                  eventSlug={slug}
                  fields={rsvpFields || []}
                  primaryColor={safePrimaryColor}
                  buttonStyle={buttonStyle}
                  allowPlusOnes={event.allow_plus_ones !== undefined ? event.allow_plus_ones : true}
                  maxGuestsPerRsvp={event.max_guests_per_rsvp || 10}
                  spotsRemaining={spotsRemaining}
                  inviteGuestId={inviteGuest?.id}
                  inviteGuestName={inviteGuest?.name}
                  inviteGuestEmail={inviteGuest?.email}
                />
              </AnimatedSection>
            </div>
          </div>
        </div>

        {/* Footer branding (free tier) */}
        {event.tier === "free" && (
          <AnimatedSection className="pb-8 text-center">
            <p className="text-xs text-muted-foreground bg-white/80 inline-block px-3 py-1 rounded-full backdrop-blur-sm shadow-sm">
              Powered by{" "}
              <span className="font-semibold">
                Seal and Send
              </span>
            </p>
          </AnimatedSection>
        )}
      </AnimatedEventLayout>

      {/* Audio player */}
      {audioUrl && <AudioPlayer audioUrl={audioUrl} />}
    </div>
  );
}
