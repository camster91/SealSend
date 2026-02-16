import { cookies } from 'next/headers';
import { AuthUser } from './types';

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get('sealsend_user');
  
  if (!userCookie?.value) {
    return null;
  }

  try {
    return JSON.parse(userCookie.value) as AuthUser;
  } catch {
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
  
  // Clear session cookies
  cookieStore.delete('sealsend_session');
  cookieStore.delete('sealsend_user');
}