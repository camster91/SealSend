import { NextResponse, type NextRequest } from 'next/server';

/**
 * CSRF: for browser state-changing API calls require Origin or Referer
 * matching this host. Missing both is rejected (except webhooks/cron).
 */
function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  if (!host) return false;

  if (origin) {
    try {
      if (new URL(origin).host === host) return true;
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      if (new URL(referer).host === host) return true;
    } catch {
      return false;
    }
  }

  // No Origin and no Referer — typical of non-browser clients.
  // Reject browser-like cookie-authenticated API mutations without proof of same origin.
  // Allow only when neither Origin nor Referer is present AND Content-Type is not a
  // browser form/json post without cookies would still need session — fail closed.
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF protection: validate origin on state-changing API requests
  const method = request.method.toUpperCase();
  if (
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
    !pathname.startsWith('/api/webhooks/') && // Webhooks use signature verification
    !pathname.startsWith('/api/cron/') // Cron uses Bearer secret
  ) {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/callback',
    '/how-it-works',
    '/pricing',
    '/use-cases',
    '/terms',
    '/privacy',
    '/robots.txt',
    '/sitemap.xml',
    '/invite/accept',
    '/client',
    '/guest/update',
  ];

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
    // Preserve full path + query (needed for invite tokens)
    const redirectTarget = pathname + (request.nextUrl.search || '');
    url.searchParams.set('redirect', redirectTarget);
    return NextResponse.redirect(url);
  }

  const authPaths = ['/login', '/signup', '/forgot-password'];
  const isAuthRoute = authPaths.some((path) => pathname === path);
  if (isAuthRoute && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    // Preserve query params (e.g., ?plan=pro) so the dashboard can handle them
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.json|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
