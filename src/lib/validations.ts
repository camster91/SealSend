import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
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
    url: z.string().url().max(500),
  })).max(10).optional(),
  max_attendees: z.number().int().min(1).max(10000).nullable().optional(),
  allow_plus_ones: z.boolean().optional(),
  max_guests_per_rsvp: z.number().int().min(1).max(50).optional(),
  design_url: z.string().optional(),
  design_type: z.enum(["image", "pdf", "upload", "video"]).default("upload"),
  customization: z
    .object({
      primaryColor: z.string().default("#7c3aed"),
      backgroundColor: z.string().default("#ffffff"),
      backgroundImage: z.string().nullable().default(null),
      fontFamily: z.string().default("Inter"),
      buttonStyle: z.enum(["rounded", "pill", "square"]).default("rounded"),
      showCountdown: z.boolean().default(true),
      audioUrl: z.string().nullable().default(null),
      logoUrl: z.string().nullable().default(null),
    })
    .optional(),
  status: z.enum(["draft", "published"]).default("draft"),
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
  respondent_name: z.string().min(1, "Your name is required"),
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
