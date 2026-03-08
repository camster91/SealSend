import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function getPublicEventBySlug(slug: string) {
  const supabase = createAdminClient();
  return await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
}

export async function getRsvpFields(eventId: string) {
  const supabase = createAdminClient();
  return await supabase
    .from("rsvp_fields")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });
}

export async function getRemainingSpots(eventId: string, maxAttendees: number | null) {
  if (!maxAttendees) return null;
  const supabase = createAdminClient();

  const { data: attendingResponses } = await supabase
    .from("rsvp_responses")
    .select("headcount")
    .eq("event_id", eventId)
    .eq("status", "attending");

  const currentTotal = (attendingResponses || []).reduce(
    (sum: number, r: { headcount: number }) => sum + (r.headcount || 1),
    0
  );
  return Math.max(0, maxAttendees - currentTotal);
}

export async function getInviteGuest(eventId: string, token: string) {
  const supabase = createAdminClient();
  return await supabase
    .from("guests")
    .select("id, name, email")
    .eq("invite_token", token)
    .eq("event_id", eventId)
    .single();
}
