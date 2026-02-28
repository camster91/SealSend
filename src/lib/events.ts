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