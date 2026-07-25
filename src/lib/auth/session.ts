import { cookies } from 'next/headers';
import { queryOne } from '@/lib/db/client';
import { AuthUser } from './types';

/**
 * Load identity from the database — never trust sealsend_user for authorization.
 */
async function loadUserProfile(
  userId: string,
  role: 'admin' | 'guest'
): Promise<Pick<AuthUser, 'email' | 'phone' | 'name' | 'eventId'>> {
  if (role === 'admin') {
    const admin = await queryOne<{ email: string; name: string | null }>(
      'SELECT email, name FROM admin_users WHERE id = $1',
      [userId]
    );
    return {
      email: admin?.email || null,
      phone: null,
      name: admin?.name || undefined,
      eventId: undefined,
    };
  }

  const guest = await queryOne<{
    email: string | null;
    phone: string | null;
    name: string;
    event_id: string;
  }>('SELECT email, phone, name, event_id FROM guests WHERE id = $1', [userId]);

  return {
    email: guest?.email || null,
    phone: guest?.phone || null,
    name: guest?.name,
    eventId: guest?.event_id,
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sealsend_session')?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    const session = await queryOne<{ user_id: string; user_role: string }>(
      'SELECT user_id, user_role FROM user_sessions WHERE session_token = $1 AND expires_at > NOW()',
      [sessionToken]
    );

    if (!session) {
      cookieStore.delete('sealsend_session');
      cookieStore.delete('sealsend_user');
      return null;
    }

    const role = session.user_role as 'admin' | 'guest';
    const profile = await loadUserProfile(session.user_id, role);

    return {
      id: session.user_id,
      email: profile.email,
      phone: profile.phone,
      role,
      name: profile.name,
      eventId: profile.eventId,
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

  if (sessionToken) {
    try {
      await queryOne('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  cookieStore.delete('sealsend_session');
  cookieStore.delete('sealsend_user');
}

export async function validateSessionToken(token: string): Promise<{
  valid: boolean;
  user?: AuthUser;
  error?: string;
}> {
  try {
    const session = await queryOne<{ user_id: string; user_role: string; expires_at: string }>(
      'SELECT user_id, user_role, expires_at FROM user_sessions WHERE session_token = $1 AND expires_at > NOW()',
      [token]
    );

    if (!session) {
      return { valid: false, error: 'Invalid or expired session' };
    }

    const role = session.user_role as 'admin' | 'guest';
    const profile = await loadUserProfile(session.user_id, role);

    const user: AuthUser = {
      id: session.user_id,
      email: profile.email,
      phone: profile.phone,
      role,
      eventId: profile.eventId,
      name: profile.name,
    };

    return { valid: true, user };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Session validation failed',
    };
  }
}

export async function invalidateSession(token: string): Promise<void> {
  await queryOne('DELETE FROM user_sessions WHERE session_token = $1', [token]);
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await queryOne('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
}
