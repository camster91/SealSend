"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDraftCreator,
  createSaveQueue,
  type SaveQueue,
  type SaveStatus,
} from "@/lib/event-builder/save-machine";
import { DEFAULT_RSVP_FIELDS } from "@/lib/constants";
import { toBuilderRsvpFields } from "@/lib/event-builder/mapping";
import type { BuilderData } from "@/lib/event-builder/schema";
import type { EventCustomization } from "@/types/database";

const AUTOSAVE_DEBOUNCE_MS = 800;
const UNSAVED_KINDS: ReadonlySet<SaveStatus["kind"]> = new Set(["saving", "retrying", "failed", "blocked"]);
const NEW_DRAFT_RSVP_FIELDS = toBuilderRsvpFields(DEFAULT_RSVP_FIELDS);

export interface UseEventDraftOptions {
  eventId?: string;
  initial: BuilderData;
  organizationId?: string;
  /** Applied over `initial.customization` before a new draft exists. */
  templateCustomization?: Partial<EventCustomization>;
  /** Where the URL points once the draft exists (default: the builder at /events/{id}/build). */
  draftPath?: (id: string) => string;
}

export interface EventDraft {
  data: BuilderData;
  update(patch: Partial<BuilderData>): void;
  eventId?: string;
  status: SaveStatus;
  ensureDraft(): Promise<string>;
  retry(): void;
  /** Sends any debounced change now and resolves to the status once every save has settled. */
  flush(): Promise<SaveStatus>;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function useEventDraft({ eventId: initialEventId, initial, organizationId, templateCustomization, draftPath }: UseEventDraftOptions): EventDraft {
  const [data, setData] = useState<BuilderData>(() => (
    !initialEventId && templateCustomization
      ? { ...initial, customization: { ...initial.customization, ...templateCustomization } }
      : initial
  ));
  const [eventId, setEventId] = useState(initialEventId);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  // True while a change waits out the debounce and has not gone to the queue yet.
  const [waiting, setWaiting] = useState(false);

  const dataRef = useRef(data);
  const eventIdRef = useRef(initialEventId);
  const lastEnqueuedRef = useRef(data);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const queueRef = useRef<SaveQueue | null>(null);
  const createDraftRef = useRef<(() => Promise<string>) | null>(null);
  const draftPathRef = useRef(draftPath);
  useEffect(() => {
    draftPathRef.current = draftPath;
  }, [draftPath]);

  // Created on first use (never during render) so the PATCH URL reads the current id.
  const getQueue = useCallback(() => {
    queueRef.current ??= createSaveQueue({
      send: (patch) => fetch(`/api/events/${eventIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
      now: () => Date.now(),
      sleep,
    });
    return queueRef.current;
  }, []);

  useEffect(() => getQueue().onStatus(setStatus), [getQueue]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const enqueueNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (mountedRef.current) setWaiting(false);
    if (!eventIdRef.current) return;
    getQueue().enqueue(lastEnqueuedRef.current, dataRef.current);
    lastEnqueuedRef.current = dataRef.current;
  }, [getQueue]);

  const update = useCallback((patch: Partial<BuilderData>) => {
    const next = { ...dataRef.current, ...patch };
    dataRef.current = next;
    setData(next);
    if (!eventIdRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(enqueueNow, AUTOSAVE_DEBOUNCE_MS);
    setWaiting(true);
  }, [enqueueNow]);

  const ensureDraft = useCallback((): Promise<string> => {
    if (eventIdRef.current) return Promise.resolve(eventIdRef.current);
    createDraftRef.current ??= createDraftCreator({
      post: (body) => fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      getData: () => dataRef.current,
      organizationId,
      queue: getQueue(),
      now: () => Date.now(),
      newDraftRsvpFields: NEW_DRAFT_RSVP_FIELDS,
      onCreated: (id, rsvpFields) => {
        // Always keep the id so edits made before the POST still get PATCHed.
        eventIdRef.current = id;
        // The server added its default questions; show them without scheduling a save.
        if (dataRef.current.rsvp_fields.length === 0 && rsvpFields.length > 0) {
          dataRef.current = { ...dataRef.current, rsvp_fields: rsvpFields };
          if (mountedRef.current) setData(dataRef.current);
        }
        lastEnqueuedRef.current = dataRef.current;
        // If the host already left, don't rewrite the URL of the page they're on now.
        if (!mountedRef.current) return;
        setEventId(id);
        // Update the URL without a navigation so the builder keeps its state (no remount).
        window.history.replaceState(null, "", draftPathRef.current?.(id) ?? `/events/${id}/build`);
      },
      report: setStatus,
    });
    return createDraftRef.current();
  }, [getQueue, organizationId]);

  const retry = useCallback(() => {
    if (!eventIdRef.current) {
      ensureDraft().catch(() => undefined);
      return;
    }
    // The queue diffs from the last confirmed save, so this re-sends whatever failed.
    enqueueNow();
  }, [ensureDraft, enqueueNow]);

  const flush = useCallback(async (): Promise<SaveStatus> => {
    enqueueNow();
    return getQueue().flush();
  }, [enqueueNow, getQueue]);

  // Never drop a debounced change when the builder unmounts.
  useEffect(() => () => enqueueNow(), [enqueueNow]);

  const unsaved = waiting || UNSAVED_KINDS.has(status.kind);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  return { data, update, eventId, status, ensureDraft, retry, flush };
}
