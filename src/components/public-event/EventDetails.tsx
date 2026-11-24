import { Calendar, MapPin, Clock, User, Shirt, CalendarClock, Gift, ExternalLink } from "lucide-react";
import { formatDateTime, formatEventDay, formatEventTime } from "@/lib/utils";
import { isDefaultInvitationCopy } from "@/lib/invitation-defaults";
import { AddToCalendar } from "@/components/public-event/AddToCalendar";
import { sanitizeUrl } from "@/lib/sanitize";
import type { Event } from "@/types/database";

interface EventDetailsProps {
  event: Event;
  /** False when the hero above already shows the title. */
  showTitle?: boolean;
}

export function EventDetails({ event, showTitle = true }: EventDetailsProps) {
  // Wording SealSend wrote only repeats the details below.
  const generated = isDefaultInvitationCopy(event);
  const mapsQuery = [event.location_name, event.location_address].filter(Boolean).join(", ");
  return (
    <div className="space-y-4">
      {showTitle && <h1 className="text-2xl font-bold">{event.title}</h1>}

      {event.invitation_headline && !generated.headline && event.invitation_headline !== event.title && (
        <h2 className="text-lg font-semibold text-gray-800">{event.invitation_headline}</h2>
      )}

      {event.invitation_body && !generated.body && (
        <p className="whitespace-pre-wrap text-muted-foreground">{event.invitation_body}</p>
      )}

      {event.description && (
        <p className="text-muted-foreground">{event.description}</p>
      )}

      <div className="space-y-3">
        {event.event_date && (
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold">{formatEventDay(event.event_date, event.event_timezone)}</p>
              <p className="text-sm text-neutral-700">
                {formatEventTime(event.event_date, event.event_timezone)}
                {event.event_end_date && ` to ${formatDateTime(event.event_end_date, event.event_timezone)}`}
              </p>
            </div>
          </div>
        )}

        {mapsQuery && (
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
            <div className="min-w-0">
              {event.location_name && <p className="text-base font-semibold">{event.location_name}</p>}
              {event.location_address && <p className="break-words text-sm text-neutral-700">{event.location_address}</p>}
              {event.location_address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4"
                >
                  Get directions
                </a>
              )}
            </div>
          </div>
        )}

        {event.host_name && (
          <div className="flex items-center gap-3 text-sm">
            <User className="h-5 w-5 text-brand-600" />
            <p className="font-medium">Hosted by {event.host_name}</p>
          </div>
        )}

        {event.dress_code && (
          <div className="flex items-center gap-3 text-sm">
            <Shirt className="h-5 w-5 text-brand-600" />
            <p className="font-medium">Dress code: {event.dress_code}</p>
          </div>
        )}

        {event.rsvp_deadline && (
          <div className="flex items-center gap-3 text-sm">
            <CalendarClock className="h-5 w-5 text-brand-600" />
            <p className="font-medium">RSVP by {formatDateTime(event.rsvp_deadline, event.event_timezone)}</p>
          </div>
        )}

        {event.customization.showCountdown && event.event_date && (
          <CountdownDisplay eventDate={event.event_date} />
        )}
      </div>

      {/* Registry Links */}
      {event.registry_links && event.registry_links.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Gift className="h-5 w-5 text-pink-500" />
            Gift Registries
          </div>
          <div className="flex flex-wrap gap-2">
            {event.registry_links.map((link, index) => {
              const safeUrl = sanitizeUrl(link.url);
              if (!safeUrl) return null;
              return (
              <a
                key={index}
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-sm font-medium text-pink-700 transition-colors hover:bg-pink-100"
              >
                {link.label}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              );
            })}
          </div>
        </div>
      )}

      <AddToCalendar event={event} />
    </div>
  );
}

function CountdownDisplay({ eventDate }: { eventDate: string }) {
  const now = new Date();
  const target = new Date(eventDate);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Clock className="h-5 w-5 text-accent-green" />
        <p className="font-medium text-accent-green">Event is happening now!</p>
      </div>
    );
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <div className="flex items-center gap-3 text-sm">
      <Clock className="h-5 w-5 text-brand-600" />
      <p className="font-medium">
        {days > 0 ? `${days} days and ` : ""}
        {hours} hours until event
      </p>
    </div>
  );
}
