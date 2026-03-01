import { cookies } from 'next/headers';
import { AuthUser } from './types';
import { createAdminClient } from '@/lib/supabase/admin';

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sealsend_session')?.value;
  
  if (!sessionToken) {
    return null;
  }

  try {
    // Validate session against database
    const adminSupabase = createAdminClient();
    const { data: session, error: sessionError } = await adminSupabase
      .from('user_sessions')
      .select('user_id, user_role, expires_at')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      // Clear invalid cookie
      cookieStore.delete('sealsend_session');
      cookieStore.delete('sealsend_user');
      return null;
    }

    // Get user info from the cookie
    const userCookie = cookieStore.get('sealsend_user')?.value;
    let userInfo: Partial<AuthUser> = {};
    
    if (userCookie) {
      try {
        userInfo = JSON.parse(userCookie);
      } catch {
        // ignore parse errors
      }
    }

    return {
      id: session.user_id,
      email: userInfo.email || null,
      phone: userInfo.phone || null,
      role: session.user_role as 'admin' | 'guest',
      name: userInfo.name,
      eventId: userInfo.eventId,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

export async function getCurrentUserRole(): Promise<'admin' | 'guest' | null> {
  const user = await getCurrentUser();
  return user?.role || null;
}

export async function requireAdmin() {
  const role = await getCurrentUserRole();
  if (role !== 'admin') {
    throw new Error('Admin access required');
  }
}

export async function requireGuestAccess(eventId?: string) {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }

  if (user.role !== 'guest') {
    throw new Error('Guest access required');
  }

  if (eventId && user.eventId !== eventId) {
    throw new Error('Access to this event is restricted');
  }
}

export async function logout() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sealsend_session')?.value;
  
  // Delete session from database if it exists
  if (sessionToken) {
    try {
      const adminSupabase = createAdminClient();
      await adminSupabase
        .from('user_sessions')
        .delete()
        .eq('session_token', sessionToken);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }
  
  // Clear session cookies
  cookieStore.delete('sealsend_session');
  cookieStore.delete('sealsend_user');
}

/**
 * Validate a session token against the database
 * This is a more thorough validation than getCurrentUser
 */
export async function validateSessionToken(token: string): Promise<{
  valid: boolean;
  user?: AuthUser;
  error?: string;
}> {
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
        // ignore parse errors
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
