import { z } from "zod";

export const CHAT_EVENT_FIELDS = [
  "title",
  "description",
  "host_name",
  "dress_code",
  "event_date",
  "event_end_date",
  "location_name",
  "location_address",
  "max_attendees",
  "invitation_headline",
  "invitation_body",
] as const;

export type ChatEventField = (typeof CHAT_EVENT_FIELDS)[number];

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// Per-field validators; caps mirror eventUpdateSchema in src/lib/validations.ts.
const fieldValidators = {
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  host_name: z.string().max(200),
  dress_code: z.string().max(100),
  event_date: z.string().regex(LOCAL_DATE_TIME),
  event_end_date: z.string().regex(LOCAL_DATE_TIME),
  location_name: z.string().max(200),
  location_address: z.string().max(500),
  max_attendees: z.number().int().min(1).max(10000),
  invitation_headline: z.string().max(200),
  invitation_body: z.string().max(2000),
} satisfies Record<ChatEventField, z.ZodType>;

export const chatEventFieldsSchema = z.object({
  title: fieldValidators.title.optional(),
  description: fieldValidators.description.optional(),
  host_name: fieldValidators.host_name.optional(),
  dress_code: fieldValidators.dress_code.optional(),
  event_date: fieldValidators.event_date.optional(),
  event_end_date: fieldValidators.event_end_date.optional(),
  location_name: fieldValidators.location_name.optional(),
  location_address: fieldValidators.location_address.optional(),
  max_attendees: fieldValidators.max_attendees.optional(),
  invitation_headline: fieldValidators.invitation_headline.optional(),
  invitation_body: fieldValidators.invitation_body.optional(),
});

export const CHAT_MAX_MESSAGES = 12;
export const CHAT_MAX_MESSAGE_CHARS = 1000;
export const CHAT_MAX_REPLY_CHARS = 400;
export const CHAT_MAX_CHIPS = 4;
export const CHAT_MAX_CHIP_CHARS = 40;

// The form's current values; BuilderData sends null for "no limit" and "" for blanks. Dates are kept loose here (they may arrive in any
// stored shape); only length caps apply.
const chatDataSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  host_name: z.string().max(200).nullable().optional(),
  dress_code: z.string().max(100).nullable().optional(),
  event_date: z.string().max(40).nullable().optional(),
  event_end_date: z.string().max(40).nullable().optional(),
  location_name: z.string().max(200).nullable().optional(),
  location_address: z.string().max(500).nullable().optional(),
  max_attendees: z.number().int().min(1).max(10000).nullable().optional(),
  invitation_headline: z.string().max(200).nullable().optional(),
  invitation_body: z.string().max(2000).nullable().optional(),
});

export const chatRequestSchema = z.object({
  eventId: z.string().uuid().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(CHAT_MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(CHAT_MAX_MESSAGES),
  data: chatDataSchema,
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(100),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

// Caps are enforced by sanitizeChatTurn, not in this schema (OpenAI strict mode).
// Sent to OpenAI as a strict JSON schema: every property is required and
// nullable, and unknown keys are disallowed.
const nullableUpdates = z.strictObject({
  title: z.string().nullable(),
  description: z.string().nullable(),
  host_name: z.string().nullable(),
  dress_code: z.string().nullable(),
  event_date: z.string().nullable(),
  event_end_date: z.string().nullable(),
  location_name: z.string().nullable(),
  location_address: z.string().nullable(),
  max_attendees: z.number().nullable(),
  invitation_headline: z.string().nullable(),
  invitation_body: z.string().nullable(),
});

export const chatModelOutputSchema = z.strictObject({
  reply: z.string(),
  chips: z.array(z.string()),
  updates: nullableUpdates,
  overwrite: z.array(z.enum(CHAT_EVENT_FIELDS)),
  ready: z.boolean(),
});

export type ChatTurn = {
  reply: string;
  chips: string[];
  updates: Partial<Record<ChatEventField, string | number>>;
  overwrite: ChatEventField[];
  ready: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChatEventField(value: unknown): value is ChatEventField {
  return typeof value === "string" && (CHAT_EVENT_FIELDS as readonly string[]).includes(value);
}

/**
 * Cleans one model turn. Returns null only when `reply` is missing or not a
 * string; everything else degrades field by field.
 */
export function sanitizeChatTurn(raw: unknown): ChatTurn | null {
  if (!isRecord(raw) || typeof raw.reply !== "string") return null;

  const reply =
    raw.reply.length > CHAT_MAX_REPLY_CHARS
      ? `${raw.reply.slice(0, CHAT_MAX_REPLY_CHARS - 1)}…`
      : raw.reply;

  const chips = Array.isArray(raw.chips)
    ? raw.chips
        .filter((c): c is string => typeof c === "string" && c.length > 0 && c.length <= CHAT_MAX_CHIP_CHARS)
        .slice(0, CHAT_MAX_CHIPS)
    : [];

  const updates: ChatTurn["updates"] = {};
  if (isRecord(raw.updates)) {
    for (const field of CHAT_EVENT_FIELDS) {
      const parsed = fieldValidators[field].safeParse(raw.updates[field]);
      if (parsed.success) updates[field] = parsed.data;
    }
  }

  const overwrite = Array.isArray(raw.overwrite)
    ? [...new Set(raw.overwrite.filter(isChatEventField))]
    : [];

  return { reply, chips, updates, overwrite, ready: raw.ready === true };
}
