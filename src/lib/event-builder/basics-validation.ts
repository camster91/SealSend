import { zonedLocalDateTimeToInstant } from "@/lib/datetime";
import type { BuilderData } from "./schema";

export type BasicsErrors = Partial<Record<keyof BuilderData, string>>;

/** The instant a zoned-local value names, or null when it is blank or not a real time. */
function instantOf(value: string, timeZone: string): number | null {
  if (!value) return null;
  try {
    return Date.parse(zonedLocalDateTimeToInstant(value, timeZone));
  } catch {
    return null;
  }
}

/**
 * Checks the Basics screen. A draft may stay blank; a published event must keep
 * its name, start and place. Dates are compared as instants in the event's timezone.
 */
export function validateBasics(d: BuilderData, opts: { published: boolean }): BasicsErrors {
  const errors: BasicsErrors = {};
  const start = instantOf(d.event_date, d.event_timezone);
  const end = instantOf(d.event_end_date, d.event_timezone);
  const deadline = instantOf(d.rsvp_deadline, d.event_timezone);

  if (start !== null && end !== null && end <= start) {
    errors.event_end_date = "The end time needs to be after the start.";
  }
  if (start !== null && deadline !== null && deadline > start) {
    errors.rsvp_deadline = "The RSVP deadline needs to be before the event.";
  }
  if (opts.published) {
    if (!d.title.trim()) errors.title = "A published event needs a name.";
    if (!d.event_date) errors.event_date = "A published event needs a start time.";
    if (!d.location_name.trim()) errors.location_name = "A published event needs a place.";
  }
  return errors;
}
