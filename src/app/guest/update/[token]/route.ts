import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';
import { batch, queryOne } from '@/lib/db/client';
import { SQL_NOW, abortCode, guard } from '@/lib/db/sqlite-dialect';
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

  const sessionToken = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tokenHash = hashMagicToken(token);
  // Usable means unexpired and unused; the guard re-checks it inside the batch so a
  // token opened twice at once still creates only one session.
  const usable = `t.token_hash = $1 AND t.expires_at > ${SQL_NOW} AND t.used_at IS NULL`;

  try {
    const record = await queryOne<MagicTokenRecord>(
      `SELECT t.id, t.guest_id, t.event_id, g.name, g.email, g.phone
       FROM guest_magic_tokens t
       JOIN guests g ON g.id = t.guest_id AND g.event_id = t.event_id
       WHERE ${usable}`,
      [tokenHash]
    );

    if (!record) {
      return errorRedirect(request);
    }

    try {
      await batch([
        guard(`EXISTS (SELECT 1 FROM guest_magic_tokens t WHERE ${usable} AND t.id = $2)`, [tokenHash, record.id], "token_used"),
        { text: `UPDATE guest_magic_tokens SET used_at = ${SQL_NOW} WHERE id = $1`, params: [record.id] },
        {
          text: `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
       VALUES ($1, 'guest', $2, $3)`,
          params: [record.guest_id, sessionToken, expiresAt],
        },
        {
          text: `UPDATE guests
       SET invite_status = 'accepted', last_login_at = ${SQL_NOW}, login_count = login_count + 1, updated_at = ${SQL_NOW}
       WHERE id = $1`,
          params: [record.guest_id],
        },
      ]);
    } catch (error) {
      if (abortCode(error) === "token_used") return errorRedirect(request);
      throw error;
    }

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
    console.error('Magic link acceptance failed:', error);
    return NextResponse.redirect(appUrl(request, '/login?error=session_failed'));
  }
}
