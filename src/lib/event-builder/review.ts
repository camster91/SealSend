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

export const RSVP_DEBOUNCE_MS = 800;
export const RSVP_SAVE_FAILED = "Something went wrong, so your questions were not saved. Change one to try again.";
export const RSVP_LABEL_MISSING = "Give each question that is switched on some words.";

/** Blank labels on switched-off questions are filled from the field name so the server accepts the list. */
export function prepareRsvpFields(fields: BuilderRsvpField[]): { fields: BuilderRsvpField[]; problem?: string } {
  if (fields.some((f) => f.is_enabled && !f.field_label.trim())) return { fields, problem: RSVP_LABEL_MISSING };
  return { fields: fields.map((f) => (f.field_label.trim() ? f : { ...f, field_label: f.field_name })) };
}

export interface RsvpSaverDeps {
  /** Saves the whole list. Resolves to an error in words, or undefined when it worked. */
  send: (fields: BuilderRsvpField[]) => Promise<string | undefined>;
  sleep: (ms: number) => Promise<void>;
  onError?: (message: string | undefined) => void;
}

export interface RsvpSaver {
  schedule(fields: BuilderRsvpField[]): void;
  /** Sends anything pending now and waits for it. Resolves to an error, or undefined when all is saved. */
  flush(): Promise<string | undefined>;
}

/** Debounces edits into one PUT, never has two in flight, and keeps a failed edit pending. */
export function createRsvpSaver({ send, sleep, onError }: RsvpSaverDeps): RsvpSaver {
  let pending: BuilderRsvpField[] | null = null;
  let generation = 0;
  let running: Promise<void> | null = null;
  let error: string | undefined;

  const setError = (next: string | undefined) => {
    error = next;
    onError?.(next);
  };

  const drain = (): Promise<void> => {
    if (running) return running;
    running = (async () => {
      while (pending) {
        const fields = pending;
        pending = null;
        let failure: string | undefined;
        try {
          failure = await send(fields);
        } catch {
          failure = RSVP_SAVE_FAILED;
        }
        if (failure) {
          if (pending === null) pending = fields;
          setError(failure);
          return;
        }
        setError(undefined);
      }
    })().finally(() => {
      running = null;
    });
    return running;
  };

  return {
    schedule(fields) {
      pending = fields;
      const mine = ++generation;
      void sleep(RSVP_DEBOUNCE_MS).then(() => {
        if (mine === generation) void drain();
      });
    },
    async flush() {
      generation++;
      await drain();
      return pending ? error : undefined;
    },
  };
}
