import type { Metadata } from "next";
import { Suspense } from "react";
import { EnhancedLoginForm } from "@/components/auth/EnhancedLoginForm";
import { getEvent } from "@/lib/events";

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center text-red-600">Event Not Found</h1>
          <p className="mt-2 text-center text-gray-600">
            The event you're trying to access doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Guest Access</h1>
          <p className="mt-2 text-gray-600">
            Access the event: <span className="font-semibold">{event.title}</span>
          </p>
          {event.event_date && (
            <p className="mt-1 text-sm text-gray-500">
              {new Date(event.event_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
        </div>

        <Suspense fallback={<div className="h-64 animate-pulse bg-gray-200 rounded-lg" />}>
          <EnhancedLoginForm 
            defaultMethod="email"
            eventId={eventId}
            isGuestMode={true}
          />
        </Suspense>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Are you the event host?{" "}
              <a 
                href="/login" 
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Admin login
              </a>
            </p>
            <p className="mt-2 text-xs text-gray-500">
              By accessing this event, you agree to respect the privacy of other guests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}