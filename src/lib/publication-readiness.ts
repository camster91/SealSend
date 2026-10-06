import type { EventBriefContext } from "@/lib/event-brief";

type DateValue = string | Date | null | undefined;

export type PublicationCandidate = {
  title?: string | null;
  event_date?: DateValue;
  event_end_date?: DateValue;
  location_name?: string | null;
  max_attendees?: number | null;
  invitation_headline?: string | null;
  invitation_body?: string | null;
  rsvp_deadline?: DateValue;
  event_brief?: EventBriefContext | null;
};

export type PublicationBlocker = {
  field: "title" | "event_date" | "event_end_date" | "location_name" | "rsvp_deadline";
  message: string;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function timestamp(value: DateValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function getPublicationReadiness(candidate: PublicationCandidate): {
  ready: boolean;
  blockers: PublicationBlocker[];
} {
  const blockers: PublicationBlocker[] = [];
  const start = timestamp(candidate.event_date);
  const end = timestamp(candidate.event_end_date);
  const deadline = timestamp(candidate.rsvp_deadline);

  if (!hasText(candidate.title)) {
    blockers.push({ field: "title", message: "Add a name for your event." });
  }
  if (start === null || Number.isNaN(start)) {
    blockers.push({ field: "event_date", message: "Pick a start date and time." });
  }
  if (end !== null && (Number.isNaN(end) || (start !== null && !Number.isNaN(start) && end <= start))) {
    blockers.push({ field: "event_end_date", message: "Set an end time after the start." });
  }
  if (!hasText(candidate.location_name)) {
    blockers.push({ field: "location_name", message: "Add where it's happening." });
  }
  if (deadline !== null && (Number.isNaN(deadline) || (start !== null && !Number.isNaN(start) && deadline >= start))) {
    blockers.push({ field: "rsvp_deadline", message: "Set the RSVP deadline before the event starts." });
  }

  return { ready: blockers.length === 0, blockers };
}
