import { createClient } from '@/lib/supabase/server';

export async function getEventById(eventId: string, userId: string) {
  const supabase = await createClient();
  return await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('user_id', userId)
    .single();
}

export async function getEventMetrics(eventId: string) {
  const supabase = await createClient();
  
  const [responses, guests] = await Promise.all([
    supabase
      .from('rsvp_responses')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
  ]);

  return {
    responseCount: responses.count || 0,
    guestCount: guests.count || 0
  };
}
