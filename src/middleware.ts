import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = ['/', '/login', '/signup', '/forgot-password', '/callback', '/how-it-works', '/pricing', '/use-cases', '/terms', '/privacy', '/robots.txt', '/sitemap.xml'];

  const isPublicRoute =
    publicPaths.some((path) => pathname === path || pathname.startsWith(path + '/')) ||
    pathname.startsWith('/e/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/uploads/') ||
    /^\/events\/[^\/]+\/(guest|public)$/.test(pathname);

  const customSession = request.cookies.get('sealsend_session')?.value;
  const isAuthenticated = !!customSession;

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
    // Preserve query params (e.g., ?plan=pro) so the dashboard can handle them
    // Keep existing search params from the original URL
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.json|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
