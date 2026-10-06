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

export interface HeldResolution {
  /** Values that are valid now and may go to the draft. */
  send: Partial<BuilderData>;
  /** Values still invalid on a published event; they stay on screen only. */
  held: Partial<BuilderData>;
  errors: BasicsErrors;
}

/**
 * Decides what a Basics edit sends. On a published event a value that fails
 * validateBasics is held back; every earlier held value is re-checked too, so
 * fixing the start time releases a held end time or RSVP deadline.
 */
export function resolveHeld(
  server: BuilderData,
  held: Partial<BuilderData>,
  patch: Partial<BuilderData>,
  published: boolean,
): HeldResolution {
  const pending = { ...held, ...patch };
  const candidate: BuilderData = { ...server, ...pending };
  const errors = validateBasics(candidate, { published });
  if (!published) return { send: patch, held: {}, errors };
  const anyError = Object.keys(errors).length > 0;
  const send: Partial<BuilderData> = {};
  const keep: Partial<BuilderData> = {};
  for (const key of Object.keys(pending) as Array<keyof BuilderData>) {
    const blocked = errors[key] !== undefined || (key === "event_timezone" && anyError);
    Object.assign(blocked ? keep : send, { [key]: pending[key] });
  }
  return { send, held: keep, errors };
}
