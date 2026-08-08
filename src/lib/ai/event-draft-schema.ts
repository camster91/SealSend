import { z } from "zod";

export const AI_EVENT_DRAFT_SCHEMA_VERSION = "1.0" as const;

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value.includes("/") || value === "UTC";
  } catch {
    return false;
  }
}

const nullableInstant = z.string().datetime({ offset: true }).nullable();

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  eventDate: nullableInstant,
  eventEndDate: nullableInstant,
  eventTimezone: z.string().min(1).max(100).refine(isIanaTimezone, "Invalid IANA timezone"),
  locationName: z.string().min(1).max(200).nullable(),
  locationAddress: z.string().min(1).max(500).nullable(),
  hostName: z.string().min(1).max(200).nullable(),
  dressCode: z.string().min(1).max(100).nullable(),
  rsvpDeadline: nullableInstant,
  maxAttendees: z.number().int().min(1).max(10_000).nullable(),
  allowPlusOnes: z.boolean(),
  maxGuestsPerRsvp: z.number().int().min(1).max(50),
}).strict();

const rsvpFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/),
  label: z.string().min(1).max(200),
  type: z.enum(["text", "select", "multiselect", "number", "email", "phone"]),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(100)).max(30),
}).strict().superRefine((field, context) => {
  const usesOptions = field.type === "select" || field.type === "multiselect";
  if (!usesOptions && field.options.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["options"],
      message: `${field.type} fields cannot include options`,
    });
  }
  if (usesOptions && field.options.length < 2) {
    context.addIssue({
      code: "custom",
      path: ["options"],
      message: `${field.type} fields require at least two options`,
    });
  }
});

const reminderSchema = z.object({
  timing: z.enum(["rsvp_deadline", "one_week_before", "one_day_before", "event_day", "after_event"]),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
}).strict();

const assumptionSchema = z.object({
  field: z.string().min(1).max(100),
  value: z.string().max(500),
  reason: z.string().min(1).max(500),
  requiresConfirmation: z.literal(true),
}).strict();

export const aiEventDraftSchema = z.object({
  schemaVersion: z.literal(AI_EVENT_DRAFT_SCHEMA_VERSION),
  event: eventSchema,
  rsvpFields: z.array(rsvpFieldSchema).max(20),
  invitation: z.object({
    headline: z.string().min(1).max(200),
    body: z.string().min(1).max(2000),
    tone: z.enum(["warm", "professional", "playful", "formal", "casual"]),
  }).strict(),
  reminders: z.array(reminderSchema).max(5),
  theme: z.object({
    style: z.string().min(1).max(100),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    imageDirection: z.string().min(1).max(500),
  }).strict(),
  missingInformation: z.array(z.string().min(1).max(100)).max(30),
  assumptions: z.array(assumptionSchema).max(30),
}).strict().superRefine((draft, context) => {
  const requiredDisclosures: Array<[unknown, string]> = [
    [draft.event.eventDate, "event.eventDate"],
    [draft.event.locationName, "event.locationName"],
  ];

  for (const [value, path] of requiredDisclosures) {
    if (value === null && !draft.missingInformation.includes(path)) {
      context.addIssue({
        code: "custom",
        path: ["missingInformation"],
        message: `${path} must be disclosed when its value is missing`,
      });
    }
  }
});

export type AiEventDraft = z.infer<typeof aiEventDraftSchema>;

export function parseAiEventDraft(input: unknown): AiEventDraft {
  return aiEventDraftSchema.parse(input);
}
