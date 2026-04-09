import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/client';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { verifyPassword } from '@/lib/password';
import { cookies } from 'next/headers';

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

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find admin user by email
    const adminUser = await queryOne<{
      id: string;
      email: string;
      name: string;
      password: string;
    }>(
      'SELECT id, email, name, password FROM admin_users WHERE email = $1',
      [email]
    );

    if (!adminUser) {
      // Don't reveal whether email exists
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordValid = await verifyPassword(password, adminUser.password);

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
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
