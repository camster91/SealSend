import type { Metadata } from "next";
import { Suspense } from "react";
import { EnhancedLoginForm } from "@/components/auth/EnhancedLoginForm";
import { getEvent } from "@/lib/events";
import { Logo } from "@/components/layout/Logo";

interface GuestLoginPageProps {
  params: Promise<{ eventId: string }>;
}

export async function generateMetadata({ params }: GuestLoginPageProps): Promise<Metadata> {
  const { eventId } = await params;
  const event = await getEvent(eventId, { publishedOnly: true });
  
  return {
    title: `Guest Access - ${event?.title || 'Event'}`,
  };
}

export default async function GuestLoginPage({ params }: GuestLoginPageProps) {
  const { eventId } = await params;
  const event = await getEvent(eventId, { publishedOnly: true });

  if (!event) {
    return (
      <main id="main-content" className="min-h-screen flex flex-col items-center justify-center bg-cotton px-4 py-12">
        <div className="mb-8">
          <Logo size="lg" />
        </div>
        <div className="max-w-md w-full rounded-2xl border border-border bg-white p-6 sm:p-8">
          <h1 className="font-display text-3xl text-center text-ink">Event not found</h1>
          <p className="mt-3 text-center text-neutral-600">
            The event you&apos;re trying to access doesn&apos;t exist or has been removed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center bg-cotton px-4 py-12">
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="max-w-md w-full rounded-2xl border border-border bg-white p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-ink">Guest access</h1>
          <p className="mt-3 text-neutral-600">
            Access the event: <span className="font-semibold text-ink">{event.title}</span>
          </p>
          {event.event_date && (
            <p className="mt-1 text-sm text-neutral-600">
              {new Date(event.event_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
        </div>

        <Suspense fallback={<div className="h-64 animate-pulse bg-neutral-100 rounded-lg" />}>
          <EnhancedLoginForm
            defaultMethod="email"
            eventId={eventId}
            isGuestMode={true}
          />
        </Suspense>

        <div className="mt-8 pt-6 border-t border-border">
          <div className="text-center">
            <p className="text-sm text-neutral-600">
              Are you the event host?{" "}
              <a
                href="/login"
                className="font-medium text-ink underline underline-offset-4 decoration-ink/30 hover:decoration-ink"
              >
                Host sign in
              </a>
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              By accessing this event, you agree to respect the privacy of other guests.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}