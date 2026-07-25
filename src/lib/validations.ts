import { z } from "zod";
import { isSafeRelativeUploadPath } from "@/lib/sanitize";

/** Reject javascript:/data: and require https or same-origin /uploads paths */
export function isSafeHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isSafeRelativeUploadPath(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const safeHttpUrl = z
  .string()
  .max(500)
  .refine(isSafeHttpUrl, "URL must be https:// or a /uploads/ path");

const optionalSafeHttpUrl = z
  .string()
  .max(500)
  .refine((v) => v === "" || isSafeHttpUrl(v), "URL must be https:// or a /uploads/ path")
  .optional();

const optionalNullableSafeHttpUrl = z
  .string()
  .max(500)
  .nullable()
  .refine((v) => v === null || isSafeHttpUrl(v), "URL must be https:// or a /uploads/ path");

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const sendCodeSchema = z
  .object({
    method: z.enum(["email", "phone"]),
    email: z.string().email().optional(),
    phone: z.string().min(7).max(30).optional(),
    eventId: z.string().uuid().optional(),
  })
  .refine((data) => (data.method === "email" ? !!data.email : !!data.phone), {
    message: "Email or phone is required for the selected method",
  });

export const verifyCodeSchema = z
  .object({
    method: z.enum(["email", "phone"]),
    email: z.string().email().optional(),
    phone: z.string().min(7).max(30).optional(),
    code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  })
  .refine((data) => (data.method === "email" ? !!data.email : !!data.phone), {
    message: "Email or phone is required for the selected method",
  });

export const eventCreateSchema = z.object({
  title: z.string().min(1, "Event title is required").max(200),
  description: z.string().max(2000).optional(),
  event_date: z.string().optional(),
  event_end_date: z.string().optional(),
  location_name: z.string().max(200).optional(),
  location_address: z.string().max(500).optional(),
  host_name: z.string().max(200).optional(),
  dress_code: z.string().max(100).optional(),
  rsvp_deadline: z.string().optional(),
  registry_links: z.array(z.object({
    label: z.string().min(1).max(100),
    url: safeHttpUrl,
  })).max(10).optional(),
  max_attendees: z.number().int().min(1).max(10000).nullable().optional(),
  allow_plus_ones: z.boolean().optional(),
  max_guests_per_rsvp: z.number().int().min(1).max(50).optional(),
  design_url: optionalSafeHttpUrl,
  design_type: z.enum(["image", "pdf", "upload", "video"]).default("upload"),
  customization: z
    .object({
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#7c3aed"),
      backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#ffffff"),
      backgroundImage: optionalNullableSafeHttpUrl.default(null),
      fontFamily: z.string().max(50).default("Inter"),
      buttonStyle: z.enum(["rounded", "pill", "square"]).default("rounded"),
      showCountdown: z.boolean().default(true),
      audioUrl: optionalNullableSafeHttpUrl.default(null),
      logoUrl: optionalNullableSafeHttpUrl.default(null),
    })
    .optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  auto_reminders: z.boolean().optional(),
});

export const eventUpdateSchema = eventCreateSchema.partial();

export const rsvpFieldSchema = z.object({
  field_name: z.string().min(1),
  field_label: z.string().min(1),
  field_type: z.enum([
    "attendance",
    "text",
    "select",
    "multiselect",
    "number",
    "email",
    "phone",
  ]),
  options: z.array(z.string()).nullable().optional(),
  placeholder: z.string().nullable().optional(),
  is_required: z.boolean().default(false),
  is_enabled: z.boolean().default(true),
  sort_order: z.number().default(0),
});

export const guestSchema = z.object({
  name: z.string().min(1, "Guest name is required").max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const guestBulkSchema = z.array(
  z.object({
    name: z.string().min(1, "Guest name is required").max(200),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(20).optional().or(z.literal("")),
    notes: z.string().max(500).optional().or(z.literal("")),
  })
).min(1, "At least one guest is required").max(500, "Maximum 500 guests per import");

export const commentSchema = z.object({
  author_name: z.string().min(1, "Name is required").max(100),
  message: z.string().min(1, "Message is required").max(1000),
  is_private: z.boolean().optional().default(false),
});

export const announcementSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(1, "Message is required").max(5000),
});

export const plusOneDataSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
});

export const rsvpSubmissionSchema = z.object({
  respondent_name: z.string().min(1, "Your name is required").max(100),
  respondent_email: z.string().email().optional().or(z.literal("")),
  status: z.enum(["attending", "not_attending", "maybe"]),
  headcount: z.number().min(1).max(50).default(1),
  response_data: z.record(z.string(), z.unknown()).default({}),
  plus_ones: z.array(plusOneDataSchema).default([]),
  guest_id: z.string().uuid().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type GuestInput = z.infer<typeof guestSchema>;
export type GuestBulkInput = z.infer<typeof guestBulkSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;
export type RSVPSubmissionInput = z.infer<typeof rsvpSubmissionSchema>;
export type PlusOneDataInput = z.infer<typeof plusOneDataSchema>;
