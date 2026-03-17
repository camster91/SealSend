import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Security headers for production
 */
function securityHeaders(request: NextRequest, response: NextResponse) {
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://api.mailgun.net https://api.twilio.com; " +
      "frame-ancestors 'none';"
    );

    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );

    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
  }

  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  return securityHeaders(request, response);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.json|opengraph-image|api/|e/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
