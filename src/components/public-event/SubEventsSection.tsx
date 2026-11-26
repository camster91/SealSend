"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { VisibleSubEvent } from "@/lib/sub-event-types";
import type { RSVPStatus } from "@/types/database";

export const RSVP_SAVED_EVENT = "sealsend:rsvp-saved";

interface SubEventsSectionProps {
  eventSlug: string;
  timezone: string;
  primaryColor: string;
  inviteToken?: string;
  initialSubEvents: VisibleSubEvent[];
}

const CHOICES: { value: RSVPStatus; label: string }[] = [
  { value: "attending", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_attending", label: "Can't go" },
];

/** Rendered only when the event has sub-events this guest may see. */
export function SubEventsSection({ eventSlug, timezone, primaryColor, inviteToken, initialSubEvents }: SubEventsSectionProps) {
  const [subEvents, setSubEvents] = useState(initialSubEvents);
  const [hasResponse, setHasResponse] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headers = inviteToken ? { "X-Guest-Token": inviteToken } : undefined;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rsvp/${eventSlug}/sub-events`, { headers: inviteToken ? { "X-Guest-Token": inviteToken } : {}, cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { sub_events: VisibleSubEvent[]; has_response: boolean };
      setSubEvents(data.sub_events);
      setHasResponse(data.has_response);
    } catch {
      // Keep the server-rendered schedule.
    }
  }, [eventSlug, inviteToken]);

  useEffect(() => {
    void load();
    const onSaved = () => void load();
    window.addEventListener(RSVP_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(RSVP_SAVED_EVENT, onSaved);
  }, [load]);

  async function answer(subEventId: string, status: RSVPStatus) {
    setSaving(subEventId);
    setError(null);
    try {
      const res = await fetch(`/api/rsvp/${eventSlug}/sub-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ responses: [{ sub_event_id: subEventId, status }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save that. Please try again.");
        return;
      }
      setSubEvents(data.sub_events);
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setSaving(null);
    }
  }

  if (subEvents.length === 0) return null;

  return (
    <section aria-labelledby="schedule-heading" className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
      <h2 id="schedule-heading" className="text-xl font-semibold">Schedule</h2>
      {!hasResponse && (
        <p className="mt-1 text-sm text-neutral-600">Send your RSVP first, then tell the host which parts you&apos;ll join.</p>
      )}
      <ul className="mt-4 space-y-4">
        {subEvents.map((item) => (
          <li key={item.id} className="rounded-lg border border-neutral-200 p-4">
            <h3 className="text-base font-semibold text-ink">{item.title}</h3>
            {item.starts_at && (
              <p className="mt-1 flex items-start gap-2 text-sm text-neutral-700">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {formatDateTime(item.starts_at, timezone)}
                  {item.ends_at && ` to ${formatDateTime(item.ends_at, timezone)}`}
                </span>
              </p>
            )}
            {(item.location_name || item.location_address) && (
              <p className="mt-1 flex items-start gap-2 text-sm text-neutral-700">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="break-words">{[item.location_name, item.location_address].filter(Boolean).join(", ")}</span>
              </p>
            )}
            {item.description && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{item.description}</p>}
            {hasResponse && (
              <div role="group" aria-label={`Your reply for ${item.title}`} className="mt-3 grid grid-cols-3 gap-2">
                {CHOICES.map((choice) => {
                  const selected = item.my_status === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      aria-pressed={selected}
                      disabled={saving === item.id}
                      onClick={() => void answer(item.id, choice.value)}
                      className="min-h-11 rounded-lg border px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60"
                      style={selected ? { backgroundColor: primaryColor, borderColor: primaryColor, color: "#fff" } : { borderColor: "#737373" }}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p aria-live="polite" role={error ? "alert" : undefined} className={error ? "mt-3 text-sm text-accent-red" : "sr-only"}>{error ?? ""}</p>
    </section>
  );
}
