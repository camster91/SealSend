import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Security headers for production
 */
function securityHeaders(request: NextRequest, response: NextResponse) {
  // Only add security headers for production
  if (process.env.NODE_ENV === 'production') {
    // Content Security Policy
    // Note: Adjust CSP based on your actual needs
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://*.supabase.co https://api.mailgun.net https://api.twilio.com; " +
      "frame-ancestors 'none';"
    );
    
    // HTTP Strict Transport Security
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
    
    // X-Frame-Options
    response.headers.set('X-Frame-Options', 'DENY');
    
    // X-Content-Type-Options
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    // Referrer Policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
  }
  
  // Always set these headers
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  return response;
}

export async function middleware(request: NextRequest) {
  // First, update session
  const response = await updateSession(request);
  
  // Add security headers
  return securityHeaders(request, response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icons, manifest
     * - public assets
     * - API routes (handled by their own auth)
     * - Public event pages (/e/slug)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.json|opengraph-image|api/|e/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};