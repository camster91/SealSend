import type { Metadata } from 'next';

// New application pages stay out of search unless their layout opts in.
export const PRIVATE_PAGE_ROBOTS = { index: false, follow: false } satisfies Metadata['robots'];
export const MARKETING_PAGE_ROBOTS = { index: true, follow: true } satisfies Metadata['robots'];

// HTTP directives cover redirects, errors, API responses and invitation downloads,
// including clients that do not render the HTML metadata.
export const PRIVATE_SEARCH_ROUTES = [
  '/e/:path*', '/events/:path*', '/guest/:path*', '/client/:path*',
  '/team/:path*', '/invite/:path*', '/unsubscribe/:path*',
  '/dashboard/:path*', '/settings/:path*', '/templates/:path*', '/ai-assistant/:path*',
  '/login', '/signup', '/forgot-password', '/callback',
  '/api/:path*', '/uploads/:path*',
] as const;

export const PRIVATE_SEARCH_HEADER = 'noindex, nofollow';
