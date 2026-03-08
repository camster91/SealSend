'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { UnauthorizedError, NotFoundError, AppError } from '@/lib/errors';

export async function toggleEventStatus(eventId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new UnauthorizedError('User not authenticated');
  }

  // 1. Fetch current event
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('id, status')
    .eq('id', eventId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !event) {
    throw new NotFoundError('Event not found');
  }

  // 2. Toggle status
  const newStatus = event.status === 'published' ? 'draft' : 'published';

  const { error: updateError } = await supabase
    .from('events')
    .update({ status: newStatus })
    .eq('id', eventId)
    .eq('user_id', user.id);

  if (updateError) {
    throw new AppError('Failed to update event status');
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true, newStatus };
}
