import { createAdminClient } from '@/lib/supabase/admin';

export async function getEvent(eventId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) {
    console.error('Error fetching event:', error);
    return null;
  }

  return data;
}

export async function getEventsByUser(userId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  return data || [];
}

export async function getInvitedEvents(userId: string) {
  const supabase = createAdminClient();

  // Find events where this user is a guest
  // First, get the user's email/phone to match against guests
  const { data: userData } = await supabase
    .from('user_sessions')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  // Get events where this user has a guest entry
  const { data: guestEntries, error: guestError } = await supabase
    .from('guests')
    .select('event_id')
    .or(`email.eq.${userId},phone.eq.${userId}`);

  if (guestError) {
    console.error('Error fetching guest entries:', guestError);
    return [];
  }

  if (!guestEntries || guestEntries.length === 0) {
    return [];
  }

  // Get the actual events
  const eventIds = guestEntries.map(g => g.event_id);
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .in('id', eventIds)
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching invited events:', error);
    return [];
  }

  return events || [];
}

export async function getEventGuests(eventId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching guests:', error);
    return [];
  }

  return data || [];
}
