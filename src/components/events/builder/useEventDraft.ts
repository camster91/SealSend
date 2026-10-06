"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDraftCreator,
  createSaveQueue,
  type SaveQueue,
  type SaveStatus,
} from "@/lib/event-builder/save-machine";
import type { BuilderData } from "@/lib/event-builder/schema";
import type { EventCustomization } from "@/types/database";

const AUTOSAVE_DEBOUNCE_MS = 800;
const UNSAVED_KINDS: ReadonlySet<SaveStatus["kind"]> = new Set(["saving", "retrying", "failed"]);

export interface UseEventDraftOptions {
  eventId?: string;
  initial: BuilderData;
  organizationId?: string;
  /** Applied over `initial.customization` before a new draft exists. */
  templateCustomization?: Partial<EventCustomization>;
}

export interface EventDraft {
  data: BuilderData;
  update(patch: Partial<BuilderData>): void;
  eventId?: string;
  status: SaveStatus;
  ensureDraft(): Promise<string>;
  retry(): void;
  /** Sends any debounced change now and resolves once every save has settled. */
  flush(): Promise<void>;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function useEventDraft({ eventId: initialEventId, initial, organizationId, templateCustomization }: UseEventDraftOptions): EventDraft {
  const [data, setData] = useState<BuilderData>(() => (
    !initialEventId && templateCustomization
      ? { ...initial, customization: { ...initial.customization, ...templateCustomization } }
      : initial
  ));
  const [eventId, setEventId] = useState(initialEventId);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  const dataRef = useRef(data);
  const eventIdRef = useRef(initialEventId);
  const lastEnqueuedRef = useRef(data);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const queueRef = useRef<SaveQueue | null>(null);
  const createDraftRef = useRef<(() => Promise<string>) | null>(null);

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
      onCreated: (id) => {
        // Always keep the id so edits made before the POST still get PATCHed.
        eventIdRef.current = id;
        lastEnqueuedRef.current = dataRef.current;
        // If the host already left, don't rewrite the URL of the page they're on now.
        if (!mountedRef.current) return;
        setEventId(id);
        // Update the URL without a navigation so the builder keeps its state (no remount).
        window.history.replaceState(null, "", `/events/${id}/build`);
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

  const flush = useCallback(async () => {
    enqueueNow();
    await getQueue().flush();
  }, [enqueueNow, getQueue]);

  // Never drop a debounced change when the builder unmounts.
  useEffect(() => () => enqueueNow(), [enqueueNow]);

  const unsaved = UNSAVED_KINDS.has(status.kind);
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
