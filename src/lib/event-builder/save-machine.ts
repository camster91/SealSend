import { toPatch } from "./mapping";
import type { BuilderData } from "./schema";

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "retrying"; attempt: 1 | 2 | 3 }
  | { kind: "failed"; message: string }
  | { kind: "blocked"; fieldErrors: Partial<Record<keyof BuilderData, string>> };

export interface SaveQueueDeps {
  send: (patch: object) => Promise<Response>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

export interface SaveQueue {
  enqueue(prev: BuilderData, next: BuilderData): void;
  flush(): Promise<void>;
  onStatus(cb: (s: SaveStatus) => void): () => void;
}

export const DEFAULT_SAVE_ERROR = "Couldn't save your changes.";
export const UNSAVEABLE_DATE_ERROR = "That date and time can't be saved. Check the times you entered.";
const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

type Outcome = { kind: "saved" } | { kind: "retry"; message: string } | { kind: "stopped" };

async function readBody(response: Response): Promise<{ error?: unknown; blockers?: unknown } | null> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

function errorMessage(body: { error?: unknown } | null): string {
  return typeof body?.error === "string" && body.error ? body.error : DEFAULT_SAVE_ERROR;
}

function fieldErrorsFrom(blockers: unknown[]): Partial<Record<keyof BuilderData, string>> {
  const fieldErrors: Record<string, string> = {};
  for (const blocker of blockers) {
    const { field, message } = (blocker ?? {}) as { field?: unknown; message?: unknown };
    if (typeof field === "string" && typeof message === "string" && !(field in fieldErrors)) {
      fieldErrors[field] = message;
    }
  }
  return fieldErrors as Partial<Record<keyof BuilderData, string>>;
}

/**
 * Serializes autosaves: at most one PATCH is in flight, and only the newest
 * pending snapshot is kept. Each send is the diff from the last snapshot the
 * server confirmed, so a slow or failed save can never overwrite newer content.
 * Network errors and 5xx retry after 1 s, 2 s and 4 s; any other failure stops
 * until the next enqueue. Debouncing is the caller's job.
 */
export function createSaveQueue(deps: SaveQueueDeps): SaveQueue {
  const listeners = new Set<(s: SaveStatus) => void>();
  let status: SaveStatus = { kind: "idle" };
  let confirmed: BuilderData | null = null;
  let pending: BuilderData | null = null;
  let running: Promise<void> | null = null;

  function emit(next: SaveStatus) {
    status = next;
    for (const listener of listeners) listener(next);
  }

  async function sendOnce(patch: object): Promise<Outcome> {
    let response: Response;
    try {
      response = await deps.send(patch);
    } catch {
      return { kind: "retry", message: DEFAULT_SAVE_ERROR };
    }
    if (response.ok) return { kind: "saved" };
    const body = await readBody(response);
    if (response.status >= 500) return { kind: "retry", message: errorMessage(body) };
    if (response.status === 400 && Array.isArray(body?.blockers) && body.blockers.length > 0) {
      emit({ kind: "blocked", fieldErrors: fieldErrorsFrom(body.blockers) });
    } else {
      emit({ kind: "failed", message: errorMessage(body) });
    }
    return { kind: "stopped" };
  }

  async function drain() {
    let lastOk = true;
    while (pending && confirmed) {
      let snapshot: BuilderData = pending;
      pending = null;
      let attempt = 0;
      for (;;) {
        let patch: object | null;
        try {
          patch = toPatch(confirmed, snapshot);
        } catch {
          emit({ kind: "failed", message: UNSAVEABLE_DATE_ERROR });
          lastOk = false;
          break;
        }
        if (!patch) {
          confirmed = snapshot;
          lastOk = true;
          break;
        }
        if (attempt === 0) emit({ kind: "saving" });
        const outcome = await sendOnce(patch);
        if (outcome.kind === "saved") {
          confirmed = snapshot;
          lastOk = true;
          break;
        }
        if (outcome.kind === "stopped") {
          lastOk = false;
          break;
        }
        if (attempt === RETRY_DELAYS_MS.length) {
          emit({ kind: "failed", message: outcome.message });
          lastOk = false;
          break;
        }
        emit({ kind: "retrying", attempt: (attempt + 1) as 1 | 2 | 3 });
        await deps.sleep(RETRY_DELAYS_MS[attempt]);
        attempt += 1;
        // Retry with the newest content; the diff from `confirmed` covers both.
        if (pending) {
          snapshot = pending;
          pending = null;
        }
      }
    }
    if (lastOk && status.kind !== "idle" && status.kind !== "saved") {
      emit({ kind: "saved", at: deps.now() });
    }
  }

  function start() {
    if (running) return;
    running = drain().finally(() => {
      running = null;
      if (pending) start();
    });
  }

  return {
    enqueue(prev, next) {
      if (!confirmed) confirmed = prev;
      pending = next;
      start();
    },
    async flush() {
      while (running) await running;
    },
    onStatus(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

/** Wraps `fn` so concurrent and later calls share one run; a rejection lets the next call try again. */
export function createSingleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (!inFlight) {
      const run = fn();
      inFlight = run;
      run.catch(() => {
        if (inFlight === run) inFlight = null;
      });
    }
    return inFlight;
  };
}
