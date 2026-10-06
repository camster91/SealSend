"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fromEvent } from "@/lib/event-builder/mapping";
import {
  createSaveQueue,
  createSingleFlight,
  DEFAULT_SAVE_ERROR,
  type SaveQueue,
  type SaveStatus,
} from "@/lib/event-builder/save-machine";
import type { BuilderData } from "@/lib/event-builder/schema";
import type { Event, EventCustomization } from "@/types/database";

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
  const router = useRouter();
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

  const postDraft = useCallback(async (): Promise<string> => {
    if (eventIdRef.current) return eventIdRef.current;
    const current = dataRef.current;
    let response: Response;
    try {
      response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: current.title,
          status: "draft",
          event_timezone: current.event_timezone,
          ...(organizationId === undefined ? {} : { organization_id: organizationId }),
          customization: current.customization,
        }),
      });
    } catch (error) {
      setStatus({ kind: "failed", message: DEFAULT_SAVE_ERROR });
      throw error;
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !body || typeof (body as { id?: unknown }).id !== "string") {
      const serverError = (body as { error?: unknown } | null)?.error;
      const message = typeof serverError === "string" && serverError ? serverError : DEFAULT_SAVE_ERROR;
      setStatus({ kind: "failed", message });
      throw new Error(message);
    }
    const created = body as Event;
    eventIdRef.current = created.id;
    setEventId(created.id);
    // Diff against what the server now holds, so anything typed before the
    // draft existed (or while the POST was in flight) is saved next.
    getQueue().enqueue(fromEvent(created, []), dataRef.current);
    lastEnqueuedRef.current = dataRef.current;
    router.replace(`/events/${created.id}/build`);
    return created.id;
  }, [getQueue, organizationId, router]);

  const ensureDraft = useCallback(() => {
    createDraftRef.current ??= createSingleFlight(postDraft);
    return createDraftRef.current();
  }, [postDraft]);

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
