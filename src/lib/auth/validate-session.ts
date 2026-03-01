/**
 * Server-side session validation
 * Validates session tokens against the database
 */

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthUser } from './types';

export interface SessionValidationResult {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

/**
 * Validate a session token against the database
 * This should be used for sensitive operations
 */
export async function validateSession(token: string): Promise<SessionValidationResult> {
  try {
    const adminSupabase = createAdminClient();

    const { data: session, error } = await adminSupabase
      .from('user_sessions')
      .select('user_id, user_role, expires_at')
      .eq('session_token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !session) {
      return { valid: false, error: 'Invalid or expired session' };
    }

    // Get additional user info from cookie for convenience
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('sealsend_user')?.value;
    let userInfo: Partial<AuthUser> = {};

    if (userCookie) {
      try {
        userInfo = JSON.parse(userCookie);
      } catch {
        // Ignore parse errors
      }
    }

    const user: AuthUser = {
      id: session.user_id,
      email: userInfo.email || null,
      phone: userInfo.phone || null,
      role: session.user_role as 'admin' | 'guest',
      eventId: userInfo.eventId,
      name: userInfo.name,
    };

    return { valid: true, user };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Session validation failed',
    };
  }
}

/**
 * Get and validate the current session from cookies
 */
export async function getValidatedSession(): Promise<SessionValidationResult> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sealsend_session')?.value;

  if (!sessionToken) {
    return { valid: false, error: 'No session found' };
  }

  return validateSession(sessionToken);
}

/**
 * Invalidate (delete) a session
 */
export async function invalidateSession(token: string): Promise<void> {
  const adminSupabase = createAdminClient();
  
  await adminSupabase
    .from('user_sessions')
    .delete()
    .eq('session_token', token);
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  const adminSupabase = createAdminClient();
  
  await adminSupabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId);
}
