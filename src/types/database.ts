export type EventStatus = "draft" | "published" | "archived";
export type EventTier = "free" | "standard" | "premium";
export type RSVPFieldType =
  | "attendance"
  | "text"
  | "select"
  | "multiselect"
  | "number"
  | "email"
  | "phone";
export type RSVPStatus = "attending" | "not_attending" | "maybe" | "pending";
export type InviteStatus = "not_sent" | "sent" | "failed";

export interface RegistryLink {
  label: string;
  url: string;
}

export interface EventCustomization {
  primaryColor: string;
  backgroundColor: string;
  backgroundImage: string | null;
  fontFamily: string;
  buttonStyle: "rounded" | "pill" | "square";
  showCountdown: boolean;
  audioUrl: string | null;
  logoUrl: string | null;
}

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  event_end_date: string | null;
  location_name: string | null;
  location_address: string | null;
  host_name: string | null;
  dress_code: string | null;
  rsvp_deadline: string | null;
  registry_links: RegistryLink[];
  location_lat: number | null;
  location_lng: number | null;
  design_url: string | null;
  design_type: string;
  customization: EventCustomization;
  slug: string;
  status: EventStatus;
  tier: EventTier;
  max_responses: number;
  max_attendees: number | null;
  allow_plus_ones: boolean;
  max_guests_per_rsvp: number;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RSVPField {
  id: string;
  event_id: string;
  field_name: string;
  field_label: string;
  field_type: RSVPFieldType;
  options: string[] | null;
  placeholder: string | null;
  is_required: boolean;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
}

export interface Guest {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  invite_token: string | null;
  invite_status: InviteStatus;
  invite_sent_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestTag {
  id: string;
  event_id: string;
  tag_name: string;
  color: string;
  created_at: string;
}

export interface GuestTagAssignment {
  guest_id: string;
  tag_id: string;
}

export interface PlusOneData {
  name: string;
  email?: string;
}

export interface PlusOne {
  id: string;
  event_id: string;
  rsvp_response_id: string;
  guest_id: string | null;
  name: string;
  email: string | null;
  status: RSVPStatus;
  invite_token: string | null;
  invite_status: InviteStatus;
  invite_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RSVPResponse {
  id: string;
  event_id: string;
  guest_id: string | null;
  respondent_name: string;
  respondent_email: string | null;
  status: RSVPStatus;
  response_data: Record<string, unknown>;
  headcount: number;
  plus_ones_data: PlusOneData[];
  submitted_at: string;
}

export interface RSVPResponseWithPlusOnes extends RSVPResponse {
  plus_ones: PlusOne[];
}

export interface EventComment {
  id: string;
  event_id: string;
  author_name: string;
  message: string;
  is_private: boolean;
  created_at: string;
}

export interface SignupItem {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  category: string | null;
  slots: number;
  sort_order: number;
  created_at: string;
}

export interface SignupClaim {
  id: string;
  item_id: string;
  event_id: string;
  claimant_name: string;
  claimant_email: string | null;
  created_at: string;
}

export interface SignupItemWithClaims extends SignupItem {
  claims: SignupClaim[];
}

export interface EventAnnouncement {
  id: string;
  event_id: string;
  subject: string;
  message: string;
  sent_to_count: number;
  created_at: string;
}
