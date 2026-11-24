import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/client';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { verifyPassword } from '@/lib/password';
import { isEmailConfigured } from '@/lib/email';
import { cookies } from 'next/headers';

const DUMMY_PASSWORD_HASH = '$2b$14$EmYXdS/qveDgpqxhzH3PZuw.EJjyipeQQnabiAxhvSttfmLAFUGGu';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: rateLimitOk } = await rateLimit(`login-password:${ip}`, {
      max: 3,
      windowSeconds: 900
    });

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body: unknown = await request.json().catch(() => null);
    const { email, password } = (body && typeof body === 'object' ? body : {}) as { email?: unknown; password?: unknown };

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Attempts from many addresses against one account share this limit.
    const accountLimit = await rateLimit(`login-password-account:${email.trim().toLowerCase()}`, {
      max: 20,
      windowSeconds: 900,
    });
    if (!accountLimit.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Find admin user by email
    const adminUser = await queryOne<{
      id: string;
      email: string;
      name: string;
      password: string;
      email_verified_at: string | null;
    }>(
      'SELECT id, email, name, password, email_verified_at FROM admin_users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    // Always perform the same expensive password check to reduce account enumeration timing.
    const passwordValid = await verifyPassword(password, adminUser?.password ?? DUMMY_PASSWORD_HASH);

    if (!adminUser || !passwordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Once codes can be delivered, the address must be proven before its password works.
    if (!adminUser.email_verified_at && isEmailConfigured()) {
      return NextResponse.json(
        { error: 'Please sign in with an email code to confirm this address is yours.' },
        { status: 403 }
      );
    }

    // Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      await query(
        `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [adminUser.id, 'admin', sessionToken, expiresAt.toISOString()]
      );
    } catch (sessionError) {
      console.error('Session creation error:', sessionError);
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

    // Set user info cookie (non-httpOnly for client-side access)
    const userInfo = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: 'admin',
    };

    // Non-httpOnly cookie for client-side display only (no sensitive fields)
    const clientUserInfo = {
      email: adminUser.email,
      name: adminUser.name,
      role: 'admin',
    };
    cookieStore.set('sealsend_user', JSON.stringify(clientUserInfo), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });

    return NextResponse.json({
      success: true,
      user: userInfo,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Password login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
