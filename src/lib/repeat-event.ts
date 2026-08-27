import { z } from "zod";

const nullableInstant = z.string().datetime({ offset: true }).nullable().optional();

export const repeatEventRequestSchema = z.object({
  title: z.string().trim().min(1, "Event title is required").max(200),
  eventDate: z.string().datetime({ offset: true }),
  eventEndDate: nullableInstant,
  rsvpDeadline: nullableInstant,
  includeGuests: z.boolean().optional().default(false),
}).strict();

export type RepeatEventRequest = {
  title: string;
  eventDate: string;
  eventEndDate: string | null;
  rsvpDeadline: string | null;
  includeGuests: boolean;
};

export function parseRepeatEventRequest(input: unknown, referenceInstant = new Date()): RepeatEventRequest {
  const parsed = repeatEventRequestSchema.parse(input);
  const eventTime = new Date(parsed.eventDate).getTime();
  if (eventTime <= referenceInstant.getTime()) {
    throw new Error("The repeated event must start in the future");
  }

  if (parsed.eventEndDate && new Date(parsed.eventEndDate).getTime() <= eventTime) {
    throw new Error("The event end must be after the event start");
  }
  if (parsed.rsvpDeadline && new Date(parsed.rsvpDeadline).getTime() >= eventTime) {
    throw new Error("The RSVP deadline must be before the event start");
  }

  return {
    title: parsed.title,
    eventDate: parsed.eventDate,
    eventEndDate: parsed.eventEndDate ?? null,
    rsvpDeadline: parsed.rsvpDeadline ?? null,
    includeGuests: parsed.includeGuests,
  };
}
