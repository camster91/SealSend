import { z } from "zod";
import type { AiEventDraft } from "@/lib/ai/event-draft-schema";

export const accessibilityStatusSchema = z.enum([
  "not_reviewed",
  "no_known_requirements",
  "requirements_known",
]);

export const communicationPreferenceSchema = z.enum([
  "undecided",
  "email",
  "sms",
  "email_and_sms",
  "none",
]);

export const eventBriefContextSchema = z.object({
  audience: z.string().trim().max(500),
  accessibilityStatus: accessibilityStatusSchema,
  accessibilityNotes: z.string().trim().max(1000).nullable(),
  communicationPreference: communicationPreferenceSchema,
}).strict();

function requireReviewedContext(brief: EventBriefContext, context: z.RefinementCtx) {
  if (brief.audience.length < 3) {
    context.addIssue({
      code: "custom",
      path: ["audience"],
      message: "Describe the intended audience.",
    });
  }
  if (brief.accessibilityStatus === "not_reviewed") {
    context.addIssue({
      code: "custom",
      path: ["accessibilityStatus"],
      message: "Review accessibility before continuing.",
    });
  }
  if (brief.accessibilityStatus === "requirements_known" && !brief.accessibilityNotes) {
    context.addIssue({
      code: "custom",
      path: ["accessibilityNotes"],
      message: "Describe the known accessibility requirements.",
    });
  }
  if (brief.communicationPreference === "undecided") {
    context.addIssue({
      code: "custom",
      path: ["communicationPreference"],
      message: "Choose the intended communication approach.",
    });
  }
}

export const eventBriefSchema = eventBriefContextSchema.extend({
  summary: z.string().trim().min(20).max(2000),
  eventDate: z.string().datetime({ offset: true }).nullable(),
  locationName: z.string().trim().min(1).max(200).nullable(),
  maxAttendees: z.number().int().min(1).max(10_000).nullable(),
}).superRefine(requireReviewedContext);

export type EventBrief = z.infer<typeof eventBriefSchema>;
export type EventBriefContext = z.infer<typeof eventBriefContextSchema>;

export function parseEventBrief(input: unknown): EventBrief {
  return eventBriefSchema.parse(input);
}

export function getEventBriefContext(brief: EventBrief): EventBriefContext {
  return {
    audience: brief.audience,
    accessibilityStatus: brief.accessibilityStatus,
    accessibilityNotes: brief.accessibilityNotes,
    communicationPreference: brief.communicationPreference,
  };
}

export function applyEventBriefToDraft(draft: AiEventDraft, brief: EventBrief): AiEventDraft {
  const missingInformation = new Set(draft.missingInformation);
  const decisions: Array<[unknown, string]> = [
    [brief.eventDate, "event.eventDate"],
    [brief.locationName, "event.locationName"],
    [brief.maxAttendees, "event.maxAttendees"],
  ];
  for (const [value, field] of decisions) {
    if (value === null) missingInformation.add(field);
    else missingInformation.delete(field);
  }

  return {
    ...draft,
    event: {
      ...draft.event,
      eventDate: brief.eventDate,
      locationName: brief.locationName,
      maxAttendees: brief.maxAttendees,
    },
    missingInformation: [...missingInformation],
  };
}
