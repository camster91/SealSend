import { query } from "@/lib/db/client";

export const ACTIVATION_EVENT_NAMES = [
  "account_created",
  "event_draft_started",
  "ai_generation_started",
  "ai_generation_completed",
  "ai_generation_accepted",
  "event_published",
  "first_guest_added",
  "first_invitation_sent",
  "first_rsvp_received",
  "checkout_started",
  "checkout_completed",
  "account_exported",
] as const;

export type ActivationEventName = (typeof ACTIVATION_EVENT_NAMES)[number];

const APPROVED_METADATA_KEYS = new Set([
  "source",
  "plan",
  "channel",
  "method",
  "status",
  "aiSchemaVersion",
  "model",
]);

type MetadataValue = string | number | boolean | null;

export interface ActivationEventInput {
  name: ActivationEventName;
  userId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ActivationEvent {
  name: ActivationEventName;
  userId: string | null;
  eventId: string | null;
  metadata: Record<string, MetadataValue>;
}

type QueryExecutor = (
  sql: string,
  params?: unknown[],
) => Promise<unknown[]>;

export function buildActivationEvent(input: ActivationEventInput): ActivationEvent {
  if (!ACTIVATION_EVENT_NAMES.includes(input.name)) {
    throw new Error(`Unknown activation event: ${String(input.name)}`);
  }

  const metadata: Record<string, MetadataValue> = {};
  for (const [key, value] of Object.entries(input.metadata ?? {})) {
    if (!APPROVED_METADATA_KEYS.has(key)) continue;
    if (
      value === null
      || typeof value === "number"
      || typeof value === "boolean"
      || typeof value === "string"
    ) {
      metadata[key] = typeof value === "string" ? value.slice(0, 100) : value;
    }
  }

  return {
    name: input.name,
    userId: input.userId ?? null,
    eventId: input.eventId ?? null,
    metadata,
  };
}

export async function recordActivationEvent(
  input: ActivationEventInput,
  execute: QueryExecutor = query,
): Promise<void> {
  const event = buildActivationEvent(input);
  await execute(
    `INSERT INTO activation_events (event_name, user_id, event_id, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT DO NOTHING`,
    [event.name, event.userId, event.eventId, JSON.stringify(event.metadata)],
  );
}

export async function recordActivationEventSafely(
  input: ActivationEventInput,
  execute: QueryExecutor = query,
): Promise<boolean> {
  try {
    await recordActivationEvent(input, execute);
    return true;
  } catch {
    return false;
  }
}
