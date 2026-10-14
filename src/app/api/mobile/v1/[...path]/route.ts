import { NextRequest, NextResponse } from 'next/server';
import { POST as sendCode } from '@/app/api/auth/send-code/route';
import { POST as verifyCode } from '@/app/api/auth/verify-code/route';
import { GET as events, POST as createEvent } from '@/app/api/events/route';
import { GET as event, PATCH as updateEvent } from '@/app/api/events/[eventId]/route';
import { GET as checkInList, PATCH as checkIn } from '@/app/api/events/[eventId]/check-in/route';
import { GET as deletionStatus, POST as requestDeletion, DELETE as cancelDeletion } from '@/app/api/account/deletion/route';
import { invalidateSession, validateSessionToken } from '@/lib/auth/session';
import { withMobileContext } from '@/lib/auth/mobile-context';
import { mobileBearer, mobileOperation } from '@/lib/mobile/routes';

export const runtime = 'nodejs';
type Context = { params: Promise<{ path: string[] }> };
async function dispatch(request: NextRequest, { params }: Context) {
  if (process.env.ENABLE_NATIVE_MOBILE_API !== 'true') return NextResponse.json({ error: 'Mobile beta is not available yet.' }, { status: 404 });
  const selected = mobileOperation(request.method, (await params).path);
  if (!selected) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    let result: NextResponse;
    if (selected.operation === 'sendCode' || selected.operation === 'verifyCode') {
      // Native host login only. Guest invitation access stays scoped on the web.
      const payload = await request.clone().json().catch(() => null);
      if (!payload || payload.method !== 'email' || payload.eventId) return NextResponse.json({ error: 'Use email host sign-in.' }, { status: 400 });
      result = await withMobileContext({ user: null, sessionToken: null }, () => selected.operation === 'sendCode' ? sendCode(request) : verifyCode(request));
    } else {
      const token = mobileBearer(request.headers.get('authorization'));
      const identity = token ? await validateSessionToken(token) : null;
      if (!token || !identity?.valid || !identity.user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
      if (identity.user.role !== 'admin') return NextResponse.json({ error: 'Host account required.' }, { status: 403 });
      const user = identity.user;
      const eventParams = { params: Promise.resolve({ eventId: selected.eventId! }) };
      result = await withMobileContext({ user, sessionToken: token }, async () => {
        switch (selected.operation) {
          case 'me': return NextResponse.json({ user });
          case 'logout': await invalidateSession(token); return NextResponse.json({ success: true });
          case 'events': return events();
          case 'createEvent': return createEvent(request);
          case 'event': return event(request, eventParams);
          case 'updateEvent': return updateEvent(request, eventParams);
          case 'checkInList': return checkInList(request, eventParams);
          case 'checkIn': return checkIn(request, eventParams);
          case 'deletionStatus': return deletionStatus();
          case 'requestDeletion': return requestDeletion();
          case 'cancelDeletion': return cancelDeletion();
          default: return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
      });
    }
    result.headers.set('Cache-Control', 'private, no-store');
    result.headers.set('Vary', 'Authorization');
    return result;
  } catch {
    return NextResponse.json({ error: 'Unable to complete that action. Please retry.' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
async function handle(request: NextRequest, context: Context) {
  const result = await dispatch(request, context);
  result.headers.set('Cache-Control', 'private, no-store');
  result.headers.set('Vary', 'Authorization');
  return result;
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
