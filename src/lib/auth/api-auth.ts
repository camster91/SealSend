import { cookies } from 'next/headers';
import { queryOne } from '@/lib/db/client';

interface AuthenticatedUser {
  id: string;
  email?: string | null;
  role: 'admin' | 'guest';
}

export async function getApiUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('sealsend_session')?.value;

    if (!sessionToken) return null;

    const session = await queryOne<{ user_id: string; user_role: string }>(
      'SELECT user_id, user_role FROM user_sessions WHERE session_token = $1 AND expires_at > NOW()',
      [sessionToken]
    );

    if (!session) return null;

    let email: string | null = null;
    if (session.user_role === 'admin') {
      const adminUser = await queryOne<{ email: string }>(
        'SELECT email FROM admin_users WHERE id = $1',
        [session.user_id]
      );
      email = adminUser?.email || null;
    }

    return {
      id: session.user_id,
      email,
      role: session.user_role as 'admin' | 'guest',
    };
  } catch {
    return null;
  }
}
