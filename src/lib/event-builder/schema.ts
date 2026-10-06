import { z } from "zod";
import { eventBriefContextSchema, type EventBriefContext } from "@/lib/event-brief";
import type { eventUpdateSchema } from "@/lib/validations";
import type { EventCustomization, RSVPField } from "@/types/database";

/** The payload PATCH /api/events/[eventId] accepts. */
export type EventUpdatePayload = z.infer<typeof eventUpdateSchema>;

export const BUILDER_SCREENS = ["basics", "look", "guests", "review"] as const;
export type BuilderScreen = (typeof BUILDER_SCREENS)[number];

/** The RSVP question fields the builder edits; ids and ordering belong to the server. */
export type BuilderRsvpField = Pick<
  RSVPField,
  "field_name" | "field_type" | "field_label" | "is_required" | "is_enabled" | "options" | "placeholder"
>;

export interface BuilderData {
  title: string;
  description: string;
  /** Zoned-local "YYYY-MM-DDTHH:mm" in event_timezone, or "" when unset. */
  event_date: string;
  event_end_date: string;
  event_timezone: string;
  location_name: string;
  location_address: string;
  host_name: string;
  dress_code: string;
  rsvp_deadline: string;
  registry_links: Array<{ label: string; url: string }>;
  max_attendees: number | null;
  allow_plus_ones: boolean;
  max_guests_per_rsvp: number;
  design_url: string;
  design_type: string;
  invitation_headline: string;
  invitation_body: string;
  event_brief: EventBriefContext | null;
  customization: EventCustomization;
  rsvp_fields: BuilderRsvpField[];
}

const nullableString = z.string().nullable();

// A draft may hold half-typed values (bad URLs, empty labels), so this checks
// shape only; eventUpdateSchema does the real validation on save.
export const builderDataSchema: z.ZodType<BuilderData> = z.object({
  title: z.string(),
  description: z.string(),
  event_date: z.string(),
  event_end_date: z.string(),
  event_timezone: z.string(),
  location_name: z.string(),
  location_address: z.string(),
  host_name: z.string(),
  dress_code: z.string(),
  rsvp_deadline: z.string(),
  registry_links: z.array(z.object({ label: z.string(), url: z.string() })),
  max_attendees: z.number().nullable(),
  allow_plus_ones: z.boolean(),
  max_guests_per_rsvp: z.number(),
  design_url: z.string(),
  design_type: z.string(),
  invitation_headline: z.string(),
  invitation_body: z.string(),
  event_brief: eventBriefContextSchema.nullable(),
  customization: z.object({
    primaryColor: z.string(),
    backgroundColor: z.string(),
    backgroundImage: nullableString,
    fontFamily: z.string(),
    buttonStyle: z.enum(["rounded", "pill", "square"]),
    showCountdown: z.boolean(),
    audioUrl: nullableString,
    logoUrl: nullableString,
    imageFit: z.enum(["contain", "cover"]).optional(),
    imagePosition: z.enum(["top", "center", "bottom"]).optional(),
  }),
  rsvp_fields: z.array(z.object({
    field_name: z.string(),
    field_type: z.enum(["attendance", "text", "select", "multiselect", "number", "email", "phone"]),
    field_label: z.string(),
    is_required: z.boolean(),
    is_enabled: z.boolean(),
    options: z.array(z.string()).nullable(),
    placeholder: nullableString,
  })),
});
