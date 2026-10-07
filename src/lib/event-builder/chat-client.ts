import {
  CHAT_EVENT_FIELDS,
  CHAT_MAX_MESSAGE_CHARS,
  CHAT_MAX_MESSAGES,
  type ChatEventField,
  type ChatRequest,
  type ChatTurn,
} from "@/lib/ai/chat-schema";
import type { SaveStatus } from "./save-machine";
import type { BuilderData } from "./schema";

/** Client-side helpers for the chat builder (pure; no React, no fetch). */

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export const OPENING_MESSAGE = "Hi! What are you planning?";
export const OPENING_CHIPS = ["Birthday party", "Community dinner", "Wedding", "Something else"];
export const RESUME_MESSAGE = "Welcome back! What would you like to change?";
export const READY_MESSAGE = "Looks ready! Review and publish?";
export const REVIEW_CHIP = "Review & publish";
export const LIMIT_MESSAGE = "You've used today's AI help. Keep going in manual mode — everything you've filled in is saved.";
export const FAILED_MESSAGE = "The assistant is having trouble right now.";
export const INVALID_MESSAGE = "That message didn't go through. Try saying it a different way.";
export const DST_GAP_MESSAGE = "That time doesn't exist on that day because the clocks change. Please pick another time.";

// The same caps the route applies to the snapshot (chatDataSchema); longer values would make it reject the whole turn.
const SNAPSHOT_CAPS: Partial<Record<ChatEventField, number>> = {
  title: 200,
  description: 2000,
  host_name: 200,
  dress_code: 100,
  event_date: 40,
  event_end_date: 40,
  location_name: 200,
  location_address: 500,
  invitation_headline: 200,
  invitation_body: 2000,
};

export function openingState(resumed: boolean): { text: string; chips: string[] } {
  return resumed ? { text: RESUME_MESSAGE, chips: [] } : { text: OPENING_MESSAGE, chips: [...OPENING_CHIPS] };
}

/** "YYYY-MM-DD" in the browser's local calendar. */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** The zone the chat talks in: the event's own (dates are validated and saved there), else the browser's, else UTC. */
export function chatTimezone(data: Pick<BuilderData, "event_timezone">): string {
  return data.event_timezone?.trim() || browserTimezone() || "UTC";
}

/** "YYYY-MM-DD" on the calendar of `timeZone`; the browser's local date if the zone is unknown. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return localToday(now);
  }
}

export const SAVE_BLOCKED_MESSAGE = "Your latest change can't be saved yet, so you're still here. Tell me a different value to fix it:";

/** What a blocked save needs fixed, one plain line each; null when the save wasn't blocked. */
export function blockedSaveDetails(status: SaveStatus): string[] | null {
  if (status.kind !== "blocked") return null;
  return [...new Set(Object.values(status.fieldErrors).filter((m): m is string => Boolean(m)))];
}

function snapshot(data: BuilderData): ChatRequest["data"] {
  const out: Record<string, string | number | null> = {};
  for (const field of CHAT_EVENT_FIELDS) {
    const value = data[field];
    const cap = SNAPSHOT_CAPS[field];
    if (field === "max_attendees") {
      const n = value as number | null;
      out[field] = typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 10000 ? n : null;
    } else {
      const text = typeof value === "string" ? value : "";
      out[field] = cap !== undefined ? text.slice(0, cap) : text;
    }
  }
  return out as ChatRequest["data"];
}

export function buildChatRequest(input: {
  eventId?: string;
  messages: ChatMessage[];
  data: BuilderData;
  today: string;
  timezone: string;
}): ChatRequest {
  return {
    ...(input.eventId ? { eventId: input.eventId } : {}),
    messages: input.messages
      .slice(-CHAT_MAX_MESSAGES)
      .map((m) => ({ role: m.role, text: m.text.slice(0, CHAT_MAX_MESSAGE_CHARS) })),
    data: snapshot(input.data),
    today: input.today,
    timezone: input.timezone,
  };
}

export interface ChatError {
  message: string;
  /** AI_FAILED (and network errors) can be tried again. */
  retry: boolean;
  /** No point sending more: the allowance is used up or chat is off. */
  blocked: boolean;
}

/** Maps a failed response (status 0 = network error) to what the host sees. */
export function chatErrorFor(status: number, body: unknown): ChatError {
  const code = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
  if (code === "AI_CHAT_LIMIT" || status === 429) return { message: LIMIT_MESSAGE, retry: false, blocked: true };
  if (code === "AI_UNAVAILABLE" || status === 503) return { message: FAILED_MESSAGE, retry: false, blocked: true };
  if (status === 400) return { message: INVALID_MESSAGE, retry: false, blocked: false };
  return { message: FAILED_MESSAGE, retry: true, blocked: false };
}

/** Chips to show after a turn; Review & publish leads once the event is ready. */
export function chipsForTurn(turn: Pick<ChatTurn, "ready" | "chips">): string[] {
  const rest = turn.chips.filter((c) => c !== REVIEW_CHIP);
  return turn.ready ? [REVIEW_CHIP, ...rest] : rest;
}

/** A draft is created once there is a name to give it, and only once. */
export function shouldCreateDraft(eventId: string | undefined, data: Pick<BuilderData, "title">): boolean {
  return !eventId && data.title.trim() !== "";
}

/** Light shape check of a 200 body; the server already validated it. */
export function isChatTurn(value: unknown): value is ChatTurn {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.reply === "string" &&
    Array.isArray(v.chips) &&
    typeof v.updates === "object" &&
    v.updates !== null &&
    Array.isArray(v.overwrite) &&
    typeof v.ready === "boolean"
  );
}

/** A reply is applied only if the host is still in the same chat session it was sent from (they haven't left since). */
export function shouldApplyReply(sentInSession: number, currentSession: number): boolean {
  return sentInSession === currentSession;
}

/** True when a date the AI sent fell in a clock-change gap (other dropped fields aren't the host's concern). */
export function droppedDate(dropped: readonly string[]): boolean {
  return dropped.some((f) => f === "event_date" || f === "event_end_date");
}

/** Assistant messages since the host last spoke: everything one turn added, so a screen reader hears all of it. */
export function latestAssistantGroup<T extends ChatMessage>(messages: readonly T[]): T[] {
  let start = messages.length;
  while (start > 0 && messages[start - 1].role === "assistant") start--;
  return messages.slice(start);
}
