/**
 * Client-side auth helpers that read from the sealsend_user cookie.
 * This cookie is set (non-httpOnly) by the verify-code API route.
 */

interface ClientUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: 'admin' | 'guest';
  eventId?: string;
  name?: string;
}

export function getClientUser(): ClientUser | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie
      .split('; ')
      .find((c) => c.startsWith('sealsend_user='));
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')));
  } catch {
    return null;
  }
}

export async function clientSignOut(): Promise<void> {
  // Call logout API to delete server-side session
  await fetch('/api/auth/logout', { method: 'POST' });
  // Clear client cookies
  document.cookie = 'sealsend_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'sealsend_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}
