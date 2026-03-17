import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { AuthUser } from './types';

export interface SessionValidationResult {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

export async function validateSession(token: string): Promise<SessionValidationResult> {
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

export async function getValidatedSession(): Promise<SessionValidationResult> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sealsend_session')?.value;

  if (!sessionToken) {
    return { valid: false, error: 'No session found' };
  }

  return validateSession(sessionToken);
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
