import type { ChatEventField, ChatTurn } from "@/lib/ai/chat-schema";
import { zonedLocalDateTimeToInstant } from "@/lib/datetime";
import type { BuilderData } from "./schema";

// Keywords only fire when the host clearly names the field; loose words like
// "from"/"by"/"at the" would let ordinary phrasing overwrite host-typed data.
const KEYWORDS: Record<ChatEventField, RegExp> = {
  title: /\b(name|title|call)\b/i,
  event_date:
    /\b(date|day|time|am|pm|tomorrow|tonight|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b|\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i,
  event_end_date: /\b(end|ends|until|finish|finishes)\b/i,
  location_name: /\b(where|place|venue|address|location)\b/i,
  location_address: /\b(where|place|venue|address|location)\b/i,
  max_attendees: /\b(people|guests|how many|capacity)\b/i,
  host_name: /\b(host|hosted)\b/i,
  dress_code: /\b(dress|wear|attire)\b/i,
  invitation_headline: /\b(invite|invitation|message|wording|headline|fun|formal)\b/i,
  invitation_body: /\b(invite|invitation|message|wording|headline|fun|formal)\b/i,
  description: /\b(about|description)\b/i,
};

export function fieldMentioned(field: ChatEventField, text: string): boolean {
  return KEYWORDS[field].test(text);
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

export function applyChatUpdates(
  data: BuilderData,
  turn: ChatTurn,
  opts: { aiOwned: Set<ChatEventField>; latestUserText: string },
): { patch: Partial<BuilderData>; aiOwned: Set<ChatEventField>; dropped: ChatEventField[] } {
  const patch: Record<string, string | number> = {};
  const aiOwned = new Set(opts.aiOwned);
  const dropped: ChatEventField[] = [];

  for (const [key, value] of Object.entries(turn.updates)) {
    const field = key as ChatEventField;
    if (value === undefined) continue;
    const writable =
      isBlank(data[field]) ||
      opts.aiOwned.has(field) ||
      (turn.overwrite.includes(field) && fieldMentioned(field, opts.latestUserText));
    if (!writable) continue;

    if (field === "event_date" || field === "event_end_date") {
      try {
        zonedLocalDateTimeToInstant(String(value), data.event_timezone);
      } catch {
        dropped.push(field);
        continue;
      }
      patch[field] = String(value);
    } else if (field === "max_attendees") {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        dropped.push(field);
        continue;
      }
      patch[field] = n;
    } else {
      patch[field] = String(value);
    }
    aiOwned.add(field);
  }

  return { patch: patch as Partial<BuilderData>, aiOwned, dropped };
}

export function markHostEdited(aiOwned: Set<ChatEventField>, fields: string[]): Set<ChatEventField> {
  const next = new Set(aiOwned);
  for (const f of fields) next.delete(f as ChatEventField);
  return next;
}
