import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface AuthenticatedUser {
  id: string;
  email?: string | null;
  role: 'admin' | 'guest';
  source: 'jwt' | 'session';
}

/**
 * Authenticate API requests using JWT token or session cookie.
 * Returns the authenticated user or null if unauthenticated.
 */
export async function getApiUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();

  // 1. Try JWT token first
  const token = cookieStore.get('sealsend_token')?.value;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      return {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        source: 'jwt',
      };
    }
  }

  // 2. Try session cookie
  try {
    const sessionToken = cookieStore.get('sealsend_session')?.value;
    if (!sessionToken) return null;

    const session = await prisma.userSession.findUnique({
      where: { session_token: sessionToken },
      select: { user_id: true, user_role: true, expires_at: true },
    });

    if (!session || session.expires_at < new Date()) return null;

    // Get user info from the cookie
    const userCookie = cookieStore.get('sealsend_user')?.value;
    let email: string | null = null;
    if (userCookie) {
      try {
        const parsed = JSON.parse(userCookie);
        email = parsed.email || null;
      } catch {
        // ignore parse errors
      }
    }

    return {
      id: session.user_id,
      email,
      role: session.user_role as 'admin' | 'guest',
      source: 'session',
    };
  } catch {
    return null;
  }
}
