import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query, queryOne } from '@/lib/db/client';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { cookies } from 'next/headers';
import { hashPassword } from '@/lib/password';
import { validateAndFormatPhone } from '@/lib/phone-validation';
import { verifyCodeSchema } from '@/lib/validations';

async function upsertHostUser(email: string | null, phone: string | null): Promise<string | null> {
  // Hosts are stored in admin_users. OTP-only accounts get an unusable random password.
  if (email) {
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (existing) return existing.id;

    const unusablePassword = await hashPassword(crypto.randomBytes(32).toString('hex'));
    const created = await queryOne<{ id: string }>(
      `INSERT INTO admin_users (email, password, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [email.toLowerCase(), unusablePassword, email.split('@')[0] || null]
    );
    return created?.id ?? null;
  }

  // Phone-only hosts: synthesize a stable email key so we can reuse admin_users.
  if (phone) {
    const syntheticEmail = `phone+${phone.replace(/\D/g, '')}@users.sealsend.local`;
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM admin_users WHERE email = $1',
      [syntheticEmail]
    );
    if (existing) return existing.id;

    const unusablePassword = await hashPassword(crypto.randomBytes(32).toString('hex'));
    const created = await queryOne<{ id: string }>(
      `INSERT INTO admin_users (email, password, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [syntheticEmail, unusablePassword, phone]
    );
    return created?.id ?? null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: rateLimitOk } = await rateLimit(`verify-code:${ip}`, { max: 5, windowSeconds: 900 });
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes before trying again.' },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsed = verifyCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { method, email, phone, code } = parsed.data;

    let lookupValue: string | undefined = email?.toLowerCase();
    if (method === 'phone' && phone) {
      const phoneValidation = validateAndFormatPhone(phone);
      if (!phoneValidation.valid || !phoneValidation.formatted) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
      }
      lookupValue = phoneValidation.formatted;
    }

    if (!lookupValue) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const recipientLimit = await rateLimit(`verify-code-recipient:${lookupValue}`, {
      max: 10,
      windowSeconds: 900,
    });
    if (!recipientLimit.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes before trying again.' },
        { status: 429 }
      );
    }

    // Verify code
    const authCode = await queryOne<{
      id: string;
      email: string | null;
      phone: string | null;
      code: string;
      role: string;
      event_id: string | null;
    }>(
      `SELECT * FROM auth_codes
       WHERE ${method === 'email' ? 'email' : 'phone'} = $1
         AND code = $2
         AND expires_at > $3`,
      [lookupValue, code, new Date().toISOString()]
    );

    if (!authCode) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 401 }
      );
    }

    // Delete used code
    await query('DELETE FROM auth_codes WHERE id = $1', [authCode.id]);

    // Determine durable user_id for the session — never use auth_codes.id for hosts
    let userId: string | null = null;
    let role: 'admin' | 'guest' = authCode.role === 'admin' ? 'admin' : 'guest';

    if (authCode.event_id) {
      // Guest access for a specific event
      role = 'guest';
      const guest = await queryOne<{ id: string }>(
        `SELECT id FROM guests
         WHERE event_id = $1 AND (${method === 'email' ? 'LOWER(email) = LOWER($2)' : 'phone = $2'})`,
        [authCode.event_id, method === 'email' ? authCode.email : authCode.phone]
      );
      if (!guest) {
        return NextResponse.json(
          { error: 'Guest record not found for this event' },
          { status: 401 }
        );
      }
      userId = guest.id;
    } else {
      // Host login/signup — upsert durable admin_users row
      role = 'admin';
      userId = await upsertHostUser(authCode.email, authCode.phone);
      if (!userId) {
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }
    }

    // Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      await query(
        `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, role, sessionToken, expiresAt.toISOString()]
      );
    } catch (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('sealsend_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });

    // Non-httpOnly cookie for client-side display only (never trusted for authz)
    const clientUserInfo = {
      email: authCode.email,
      phone: authCode.phone,
      role,
      eventId: authCode.event_id,
      name: authCode.email?.split('@')[0] || null,
    };
    cookieStore.set('sealsend_user', JSON.stringify(clientUserInfo), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: authCode.email,
        phone: authCode.phone,
        role,
        eventId: authCode.event_id,
      },
      message: role === 'admin' ? 'Login successful' : 'Guest access granted'
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
