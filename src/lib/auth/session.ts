import { cookies } from 'next/headers';
import { queryOne } from '@/lib/db/client';
import { AuthUser } from './types';
import { prisma } from '@/lib/db';

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sealsend_session')?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    const session = await prisma.userSession.findUnique({
      where: { session_token: sessionToken },
      select: { user_id: true, user_role: true, expires_at: true },
    });

    if (!session || session.expires_at < new Date()) {
      cookieStore.delete('sealsend_session');
      cookieStore.delete('sealsend_user');
      return null;
    }

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

  if (sessionToken) {
    try {
      await prisma.userSession.deleteMany({
        where: { session_token: sessionToken },
      });
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  cookieStore.delete('sealsend_session');
  cookieStore.delete('sealsend_token');
  cookieStore.delete('sealsend_user');
}

export async function validateSessionToken(token: string): Promise<{
  valid: boolean;
  user?: AuthUser;
  error?: string;
}> {
  try {
    const session = await prisma.userSession.findUnique({
      where: { session_token: token },
      select: { user_id: true, user_role: true, expires_at: true },
    });

    if (!session || session.expires_at < new Date()) {
      return { valid: false, error: 'Invalid or expired session' };
    }

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

export async function invalidateSession(token: string): Promise<void> {
  await prisma.userSession.deleteMany({
    where: { session_token: token },
  });
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await prisma.userSession.deleteMany({
    where: { user_id: userId },
  });
}
