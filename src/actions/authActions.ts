'use server';

import { createClient } from '@/lib/supabase/server';
import { UnauthorizedError, ValidationError, AppError } from '@/lib/errors';
import { revalidatePath } from 'next/cache';

export async function loginWithPassword(email: string, password: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.status === 400) {
      throw new ValidationError('Invalid email or password');
    }
    throw new AppError(error.message);
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function verifyOtp(email: string, token: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    throw new ValidationError('Invalid or expired code');
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function sendOtp(email: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, 
    },
  });

  if (error) {
    throw new AppError(error.message);
  }

  return { success: true };
}
