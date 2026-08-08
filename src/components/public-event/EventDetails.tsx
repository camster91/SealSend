import { Calendar, MapPin, Clock, User, Shirt, CalendarClock, Gift, ExternalLink } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { AddToCalendar } from "@/components/public-event/AddToCalendar";
import { sanitizeUrl } from "@/lib/sanitize";
import type { Event } from "@/types/database";

interface EventDetailsProps {
  event: Event;
}

export function EventDetails({ event }: EventDetailsProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{event.title}</h1>

      {event.description && (
        <p className="text-muted-foreground">{event.description}</p>
      )}

      <div className="space-y-3">
        {event.event_date && (
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-5 w-5 text-brand-600" />
            <div>
              <p className="font-medium">
                {formatDateTime(event.event_date, event.event_timezone)}
              </p>
              {event.event_end_date && (
                <p className="text-muted-foreground">
                  to {formatDateTime(event.event_end_date, event.event_timezone)}
                </p>
              )}
            </div>
          </div>
        )}

        {event.location_name && (
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-5 w-5 text-brand-600" />
            <div>
              <p className="font-medium">{event.location_name}</p>
              {event.location_address && (
                <p className="text-muted-foreground">
                  {event.location_address}
                </p>
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
