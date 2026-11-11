import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db/client';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { hashPassword } from '@/lib/password';
import { isPasswordSignupEnabled } from '@/lib/email';
import { recordActivationEventSafely } from '@/lib/analytics/activation-events';

/**
 * Email + password sign-up.
 *
 * Only open while no email provider is configured: then a host can't receive a
 * sign-in code, so this is the only way to create an account. Once email works,
 * sign-up goes back to email codes (which also prove the address is theirs).
 */
const signupPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').max(254),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  name: z.string().trim().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!isPasswordSignupEnabled()) {
      return NextResponse.json(
        { error: 'Sign up with your email code instead.' },
        { status: 403 }
      );
    }

    const ip = getClientIp(request);
    const { success: rateLimitOk } = await rateLimit(`signup-password:${ip}`, { max: 5, windowSeconds: 900 });
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many sign-up attempts. Please try again later.' },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsed = signupPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? 'Invalid request';
      return NextResponse.json({ error: first }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const name = parsed.data.name || email.split('@')[0] || null;

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Sign in instead.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const created = await queryOne<{ id: string }>(
      `INSERT INTO admin_users (email, password, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, passwordHash, name]
    );
    if (!created?.id) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Sign in instead.' },
        { status: 409 }
      );
    }

    await recordActivationEventSafely({
      name: 'account_created',
      userId: created.id,
      metadata: { method: 'password' },
    });

    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [created.id, 'admin', sessionToken, expiresAt.toISOString()]
    );

    const cookieStore = await cookies();
    cookieStore.set('sealsend_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });
    cookieStore.set('sealsend_user', JSON.stringify({ email, name, role: 'admin' }), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: { id: created.id, email, name, role: 'admin' },
      message: 'Account created',
    });
  } catch (error) {
    console.error('Password sign-up error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
