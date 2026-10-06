import { instantToZonedLocalDateTime, zonedLocalDateTimeToInstant } from "@/lib/datetime";
import type { Event, EventCustomization, RSVPField } from "@/types/database";
import type { BuilderData, EventUpdatePayload } from "./schema";

const DATE_KEYS = ["event_date", "event_end_date", "rsvp_deadline"] as const;

function customizationFrom(source: Partial<EventCustomization> | null | undefined): EventCustomization {
  return {
    primaryColor: source?.primaryColor ?? "#1b2a4a",
    backgroundColor: source?.backgroundColor ?? "#ffffff",
    backgroundImage: source?.backgroundImage ?? "",
    fontFamily: source?.fontFamily ?? "Inter",
    buttonStyle: source?.buttonStyle ?? "rounded",
    showCountdown: source?.showCountdown ?? true,
    audioUrl: source?.audioUrl ?? "",
    logoUrl: source?.logoUrl ?? "",
    imageFit: source?.imageFit ?? "contain",
    imagePosition: source?.imagePosition ?? "center",
  };
}

export function emptyBuilderData(timezone: string, customization?: Partial<EventCustomization>): BuilderData {
  return {
    title: "",
    description: "",
    event_date: "",
    event_end_date: "",
    event_timezone: timezone || "UTC",
    location_name: "",
    location_address: "",
    host_name: "",
    dress_code: "",
    rsvp_deadline: "",
    registry_links: [],
    max_attendees: null,
    allow_plus_ones: true,
    max_guests_per_rsvp: 10,
    design_url: "",
    design_type: "upload",
    invitation_headline: "",
    invitation_body: "",
    event_brief: null,
    customization: customizationFrom(customization),
    rsvp_fields: [],
  };
}

export function fromEvent(event: Event, rsvpFields: RSVPField[]): BuilderData {
  const timeZone = event.event_timezone || "UTC";
  const local = (value: string | null | undefined) => (value ? instantToZonedLocalDateTime(value, timeZone) : "");
  return {
    title: event.title ?? "",
    description: event.description ?? "",
    event_date: local(event.event_date),
    event_end_date: local(event.event_end_date),
    event_timezone: timeZone,
    location_name: event.location_name ?? "",
    location_address: event.location_address ?? "",
    host_name: event.host_name ?? "",
    dress_code: event.dress_code ?? "",
    rsvp_deadline: local(event.rsvp_deadline),
    registry_links: event.registry_links ?? [],
    max_attendees: event.max_attendees,
    allow_plus_ones: event.allow_plus_ones,
    max_guests_per_rsvp: event.max_guests_per_rsvp,
    design_url: event.design_url ?? "",
    design_type: event.design_type ?? "upload",
    invitation_headline: event.invitation_headline ?? "",
    invitation_body: event.invitation_body ?? "",
    event_brief: event.event_brief ?? null,
    customization: customizationFrom(event.customization),
    rsvp_fields: (rsvpFields ?? []).map((f) => ({
      field_name: f.field_name,
      field_type: f.field_type,
      field_label: f.field_label,
      is_required: f.is_required,
      is_enabled: f.is_enabled,
      options: f.options ?? null,
      placeholder: f.placeholder ?? null,
    })),
  };
}

/**
 * The PATCH body that turns `prev` into `next`: changed top-level fields only,
 * or null when nothing changed. rsvp_fields is left out (it has its own route).
 * If the timezone changes, set dates are re-sent so they keep their wall-clock time.
 */
export function toPatch(prev: BuilderData, next: BuilderData): Partial<EventUpdatePayload> | null {
  const patch: Record<string, unknown> = {};
  const timezoneChanged = prev.event_timezone !== next.event_timezone;

  for (const key of Object.keys(next) as Array<keyof BuilderData>) {
    if (key === "rsvp_fields") continue;
    const isDate = (DATE_KEYS as readonly string[]).includes(key);
    const changed = JSON.stringify(prev[key]) !== JSON.stringify(next[key])
      || (isDate && timezoneChanged && next[key] !== "");
    if (!changed) continue;
    if (isDate) {
      const value = next[key] as string;
      patch[key] = value === "" ? null : zonedLocalDateTimeToInstant(value, next.event_timezone);
    } else {
      patch[key] = next[key];
    }
  }
  return Object.keys(patch).length === 0 ? null : (patch as Partial<EventUpdatePayload>);
}

/** A blank or half-typed date shows as unset in the preview instead of throwing. */
function previewInstant(value: string, timeZone: string): string | null {
  if (!value) return null;
  try {
    return zonedLocalDateTimeToInstant(value, timeZone);
  } catch {
    return null;
  }
}

/** The Event the public invite components render for the live preview. Never throws. */
export function builderDataToPreviewEvent(data: BuilderData): Event {
  const zone = data.event_timezone || "UTC";
  const now = new Date(0).toISOString();
  return {
    id: "preview",
    user_id: "preview",
    title: data.title,
    description: data.description || null,
    invitation_headline: data.invitation_headline || null,
    invitation_body: data.invitation_body || null,
    reminder_sequence: [],
    event_brief: data.event_brief,
    ai_generation_id: null,
    repeated_from_event_id: null,
    event_date: previewInstant(data.event_date, zone),
    event_end_date: previewInstant(data.event_end_date, zone),
    event_timezone: zone,
    location_name: data.location_name || null,
    location_address: data.location_address || null,
    host_name: data.host_name || null,
    dress_code: data.dress_code || null,
    rsvp_deadline: previewInstant(data.rsvp_deadline, zone),
    registry_links: data.registry_links,
    location_lat: null,
    location_lng: null,
    design_url: data.design_url || null,
    design_type: data.design_type,
    customization: data.customization,
    slug: "preview",
    status: "draft",
    tier: "free",
    max_responses: 0,
    max_attendees: data.max_attendees,
    allow_plus_ones: data.allow_plus_ones,
    max_guests_per_rsvp: data.max_guests_per_rsvp,
    auto_reminders: false,
    payment_id: null,
    created_at: now,
    updated_at: now,
  };
}
