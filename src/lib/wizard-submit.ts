// Small decisions the event wizard makes when it submits, kept here so they can be tested.

/** Map an AI-drafted RSVP field type onto a type `rsvpFieldSchema` accepts. */
export function aiFieldTypeToRsvpFieldType(type: string): string {
  if (type === "multiselect") return "select";
  return type;
}

/**
 * Status to send with the wizard's payload. Editing only ever publishes: leaving the
 * "publish" switch off keeps the event's current status instead of unpublishing it.
 */
export function wizardSubmitStatus(mode: "create" | "edit", publish: boolean): "published" | "draft" | undefined {
  if (publish) return "published";
  return mode === "edit" ? undefined : "draft";
}
