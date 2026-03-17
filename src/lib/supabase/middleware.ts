import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Session check using JWT cookie / DB session instead of Supabase.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/callback',
    '/how-it-works',
    '/pricing',
    '/use-cases',
  ];

  const isPublicRoute =
    publicPaths.some(
      (path) => pathname === path || pathname.startsWith(path + '/'),
    ) ||
    pathname.startsWith('/e/') ||
    pathname.startsWith('/api/') ||
    /^\/events\/[^\/]+\/(guest|public)$/.test(pathname);

  // Check authentication via session cookie
  const sessionToken = request.cookies.get('sealsend_session')?.value;
  let isAuthenticated = false;

  if (sessionToken) {
    try {
      const session = await prisma.userSession.findUnique({
        where: { session_token: sessionToken },
        select: { expires_at: true },
      });
      isAuthenticated = !!session && session.expires_at > new Date();
    } catch {
      // DB error — treat as unauthenticated
    }
  }

  if (!isPublicRoute && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  const authPaths = ['/login', '/signup', '/forgot-password'];
  const isAuthRoute = authPaths.some((path) => pathname === path);

  if (isAuthRoute && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}
