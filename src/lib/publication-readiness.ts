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
  field: keyof PublicationCandidate | "event_brief.audience" | "event_brief.accessibilityStatus" | "event_brief.communicationPreference";
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
    blockers.push({ field: "title", message: "Add an event title." });
  }
  if (start === null || Number.isNaN(start)) {
    blockers.push({ field: "event_date", message: "Set a valid start date and time." });
  }
  if (end !== null && (Number.isNaN(end) || (start !== null && !Number.isNaN(start) && end <= start))) {
    blockers.push({ field: "event_end_date", message: "Set an end time after the event starts." });
  }
  if (!hasText(candidate.location_name)) {
    blockers.push({ field: "location_name", message: "Add the event location or access details." });
  }
  if (!Number.isInteger(candidate.max_attendees) || Number(candidate.max_attendees) < 1) {
    blockers.push({ field: "max_attendees", message: "Set the event capacity." });
  }
  if (!hasText(candidate.event_brief?.audience)) {
    blockers.push({ field: "event_brief.audience", message: "Describe who the event is for." });
  }
  if (
    !candidate.event_brief
    || candidate.event_brief.accessibilityStatus === "not_reviewed"
    || (candidate.event_brief.accessibilityStatus === "requirements_known" && !hasText(candidate.event_brief.accessibilityNotes))
  ) {
    blockers.push({ field: "event_brief.accessibilityStatus", message: "Review the event's accessibility needs." });
  }
  if (!candidate.event_brief || candidate.event_brief.communicationPreference === "undecided") {
    blockers.push({ field: "event_brief.communicationPreference", message: "Choose the intended guest communication approach." });
  }
  if (!hasText(candidate.invitation_headline)) {
    blockers.push({ field: "invitation_headline", message: "Review and add the invitation headline." });
  }
  if (!hasText(candidate.invitation_body)) {
    blockers.push({ field: "invitation_body", message: "Review and add the invitation message." });
  }
  if (deadline !== null && (Number.isNaN(deadline) || (start !== null && !Number.isNaN(start) && deadline >= start))) {
    blockers.push({ field: "rsvp_deadline", message: "Set the RSVP deadline before the event starts." });
  }

  return { ready: blockers.length === 0, blockers };
}
