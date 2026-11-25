import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';
import { batch, queryOne } from '@/lib/db/client';
import { SQL_NOW, abortCode, guard } from '@/lib/db/sqlite-dialect';
import { hashMagicToken, isValidMagicToken } from '@/lib/magic-token';
import { escapeHtml } from '@/lib/utils';

type RouteParams = { params: Promise<{ token: string }> };

interface MagicTokenRecord {
  id: string;
  guest_id: string;
  event_id: string;
  slug: string;
  title: string;
  name: string;
  email: string | null;
  phone: string | null;
}

function appUrl(request: NextRequest, pathname: string) {
  return new URL(pathname, process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.url);
}

function errorRedirect(request: NextRequest) {
  const response = NextResponse.redirect(appUrl(request, '/invite/problem'));
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

const USABLE_TOKEN_SQL = `t.token_hash = $1 AND t.expires_at > ${SQL_NOW} AND t.used_at IS NULL`;

async function findUsableRecord(tokenHash: string) {
  return queryOne<MagicTokenRecord>(
    `SELECT t.id, t.guest_id, t.event_id, e.slug, e.title, g.name, g.email, g.phone
     FROM guest_magic_tokens t
     JOIN guests g ON g.id = t.guest_id AND g.event_id = t.event_id
     JOIN events e ON e.id = t.event_id AND e.status = 'published'
     WHERE ${USABLE_TOKEN_SQL}`,
    [tokenHash]
  );
}

/**
 * GET validates the token without consuming it so email security link-scanners
 * cannot burn a single-use magic link before the guest opens it.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  if (!isValidMagicToken(token)) return errorRedirect(request);

  try {
    const record = await findUsableRecord(hashMagicToken(token));
    if (!record) return errorRedirect(request);

    const safeTitle = escapeHtml(record.title || 'your invitation');
    const safeName = escapeHtml(record.name || 'Guest');
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Open ${safeTitle} - SealSend</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#faf9f7;color:#1c1917;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    main{background:#fff;border:1px solid #e7e5e4;border-radius:16px;max-width:420px;width:100%;padding:32px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}
    h1{font-size:20px;margin:0 0 8px}
    p{font-size:14px;color:#57534e;margin:0 0 24px;line-height:1.5}
    button{width:100%;background:#1c1917;color:#fff;border:0;border-radius:10px;padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer}
    button:hover{background:#292524}
  </style>
</head>
<body>
  <main>
    <h1>Welcome, ${safeName}</h1>
    <p>Continue to view or update your RSVP for <strong>${safeTitle}</strong>.</p>
    <form method="POST">
      <button type="submit" autofocus>Continue to invitation</button>
    </form>
  </main>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    console.error('Magic link verification failed:', error);
    return errorRedirect(request);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  if (!isValidMagicToken(token)) return errorRedirect(request);

  const sessionToken = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tokenHash = hashMagicToken(token);

  try {
    const record = await findUsableRecord(tokenHash);
    if (!record) return errorRedirect(request);

    try {
      await batch([
        guard(`EXISTS (SELECT 1 FROM guest_magic_tokens t WHERE ${USABLE_TOKEN_SQL} AND t.id = $2)`, [tokenHash, record.id], "token_used"),
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

    const response = NextResponse.redirect(appUrl(request, `/e/${encodeURIComponent(record.slug)}`), { status: 303 });
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
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
    return errorRedirect(request);
  }
}
