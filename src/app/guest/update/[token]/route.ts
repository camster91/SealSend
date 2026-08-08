import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { hashMagicToken, isValidMagicToken } from '@/lib/magic-token';

type RouteParams = { params: Promise<{ token: string }> };

interface MagicTokenRecord {
  id: string;
  guest_id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

function appUrl(request: NextRequest, pathname: string) {
  return new URL(pathname, process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.url);
}

function errorRedirect(request: NextRequest) {
  return NextResponse.redirect(appUrl(request, '/login?error=invalid_invite'));
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  if (!isValidMagicToken(token)) return errorRedirect(request);

  const client = await getDb().connect();
  const sessionToken = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    await client.query('BEGIN');
    const result = await client.query<MagicTokenRecord>(
      `SELECT t.id, t.guest_id, t.event_id, g.name, g.email, g.phone
       FROM guest_magic_tokens t
       JOIN guests g ON g.id = t.guest_id AND g.event_id = t.event_id
       WHERE t.token_hash = $1 AND t.expires_at > NOW() AND t.used_at IS NULL
       FOR UPDATE OF t`,
      [hashMagicToken(token)]
    );
    const record = result.rows[0];

    if (!record) {
      await client.query('ROLLBACK');
      return errorRedirect(request);
    }

    await client.query('UPDATE guest_magic_tokens SET used_at = NOW() WHERE id = $1', [record.id]);
    await client.query(
      `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
       VALUES ($1, 'guest', $2, $3)`,
      [record.guest_id, sessionToken, expiresAt.toISOString()]
    );
    await client.query(
      `UPDATE guests
       SET invite_status = 'accepted', last_login_at = NOW(), login_count = login_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [record.guest_id]
    );
    await client.query('COMMIT');

    const response = NextResponse.redirect(appUrl(request, `/events/${record.event_id}/guest`));
    response.cookies.set('sealsend_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
    response.cookies.set(
      'sealsend_user',
      JSON.stringify({
        email: record.email,
        phone: record.phone,
        role: 'guest',
        eventId: record.event_id,
        name: record.name,
      }),
      {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      }
    );
    return response;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Magic link acceptance failed:', error);
    return NextResponse.redirect(appUrl(request, '/login?error=session_failed'));
  } finally {
    client.release();
  }
}
