import { NextResponse, type NextRequest } from 'next/server';

function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  // Allow requests with no origin (same-origin navigations, server-to-server)
  if (!origin) return true;

  // Validate origin matches host
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return true;
  } catch {
    // Invalid origin URL
  }

  // Check referer as fallback
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost === host) return true;
    } catch {
      // Invalid referer URL
    }
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF protection: validate origin on state-changing API requests
  const method = request.method.toUpperCase();
  if (
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
    !pathname.startsWith('/api/webhooks/') // Webhooks use signature verification
  ) {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

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
