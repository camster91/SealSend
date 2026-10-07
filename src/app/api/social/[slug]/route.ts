import { NextResponse } from 'next/server';
import { resolveSocialAccess, ensureSocialSchema, socialCookieName } from '@/lib/social/access';
import { loadSocialState } from '@/lib/social/store';
import { applyGuestAction, socialTransaction } from '@/lib/social/actions';
import { guestActionSchema } from '@/lib/social/contracts';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
type Context = { params: Promise<{ slug: string }> };
const deny = () => NextResponse.json({ error: 'Open your personal invitation to join in.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: Request, { params }: Context) {
  try {
    const { slug } = await params;
    const limit = await rateLimit(`social-read:${getClientIp(request)}`, { max: 120, windowSeconds: 60 });
    if (!limit.success) return NextResponse.json({ error: 'Please try again shortly.' }, { status: 429 });
    const access = await resolveSocialAccess(request, slug);
    if (!access) return deny();
    await ensureSocialSchema();
    const state = await loadSocialState(access.event.id, access.guest.id, access.event.event_date);
    const response = NextResponse.json(state, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, X-Guest-Token' } });
    if (access.token) response.cookies.set(socialCookieName(access.event.id), access.token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
      path: `/api/social/${slug}`, maxAge: 7 * 86400,
    });
    return response;
  } catch { return NextResponse.json({ error: 'Unable to load event activities.' }, { status: 503 }); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const { slug } = await params;
    const access = await resolveSocialAccess(request, slug);
    if (!access) return deny();
    const limit = await rateLimit(`social-write:${access.event.id}:${access.guest.id}`, { max: 30, windowSeconds: 60 });
    if (!limit.success) return NextResponse.json({ error: 'Please try again shortly.' }, { status: 429 });
    const parsed = guestActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Check your selection.' }, { status: 400 });
    await ensureSocialSchema();
    const saved = await socialTransaction(access.event.id, db => applyGuestAction(access.event.id, access.guest.id, parsed.data, db));
    if (!saved) return NextResponse.json({ error: 'This activity is unavailable or closed.' }, { status: 409 });
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Unable to save. Please try again.' }, { status: 503 }); }
}
