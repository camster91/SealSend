import type { RSVPStatus } from "@/types/database";

export type SubEventVisibility = "all" | "invited_only";

export interface EventSubEvent {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  location_address: string | null;
  visibility: SubEventVisibility;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HostSubEvent extends EventSubEvent {
  attending_headcount: number;
  attending_count: number;
  maybe_count: number;
  not_attending_count: number;
  invited_guest_ids: string[];
}

export interface VisibleSubEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  location_address: string | null;
  visibility: SubEventVisibility;
  sort_order: number;
  my_status: RSVPStatus | null;
  my_headcount: number | null;
}
