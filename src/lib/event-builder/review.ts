import type { PublicationBlocker, PublicationCandidate } from "@/lib/publication-readiness";
import { builderDataToPreviewEvent } from "./mapping";
import type { BuilderData, BuilderRsvpField } from "./schema";

export interface PrimaryAction {
  kind: "publish" | "save";
  label: string;
  /** The publish route toggles status, so it must only run on a draft. */
  callsPublish: boolean;
}

/** A published event only saves; the publish route would turn it back into a draft. */
export function primaryAction({ published }: { published: boolean }): PrimaryAction {
  return published
    ? { kind: "save", label: "Save changes", callsPublish: false }
    : { kind: "publish", label: "Publish", callsPublish: true };
}

/** What getPublicationReadiness should check: the zoned-local dates as real instants. */
export function buildReadinessCandidate(data: BuilderData): PublicationCandidate {
  const event = builderDataToPreviewEvent(data);
  return {
    title: event.title,
    event_date: event.event_date,
    event_end_date: event.event_end_date,
    location_name: event.location_name,
    rsvp_deadline: event.rsvp_deadline,
  };
}

export function rsvpFieldsChanged(saved: BuilderRsvpField[], current: BuilderRsvpField[]): boolean {
  return JSON.stringify(saved) !== JSON.stringify(current);
}

const GENERIC = "Something went wrong, so your invite is not live yet. Please try again.";

/** Turns a failed publish response into blockers to list, or a sentence in plain words. */
export function describePublishError(status: number, body: unknown): { blockers: PublicationBlocker[]; message?: string } {
  const json = (body && typeof body === "object" ? body : {}) as { blockers?: unknown };
  if (status === 400 && Array.isArray(json.blockers) && json.blockers.length > 0) {
    return { blockers: json.blockers as PublicationBlocker[] };
  }
  if (status === 409) return { blockers: [], message: "This event is archived, so it can't be published. Repeat it to start a new draft." };
  return { blockers: [], message: GENERIC };
}
