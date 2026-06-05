import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/client';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { cookies } from 'next/headers';
import { validateAndFormatPhone } from '@/lib/phone-validation';

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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const { method, email, phone, code, eventId } = body as { method?: string; email?: string; phone?: string; code?: string; eventId?: string };

    if (!method || !code || (!email && !phone)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Normalize phone number for consistent rate limiting and querying
    let formattedPhone: string | null = null;
    if (method === 'phone' && phone) {
      const phoneValidation = validateAndFormatPhone(phone);
      if (!phoneValidation.valid) {
        return NextResponse.json(
          { error: phoneValidation.error || 'Invalid phone number' },
          { status: 400 }
        );
      }
      formattedPhone = phoneValidation.formatted ?? null;
    }

    // Identifier-based rate limiting to prevent distributed brute-force attacks
    // Normalize identifier (email to lowercase, phone to E.164) to prevent bypasses
    const identifier = method === 'email' ? email?.toLowerCase() : formattedPhone;
    if (identifier) {
      const { success: idRateLimitOk } = await rateLimit(`verify-code-id:${identifier}`, {
        max: 5,
        windowSeconds: 900
      });
      if (!idRateLimitOk) {
        return NextResponse.json(
          { error: 'Too many verification attempts. Please wait 15 minutes.' },
          { status: 429 }
        );
      }
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
      [method === 'email' ? email : formattedPhone, code, new Date().toISOString()]
    );

    if (!authCode) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 401 }
      );
    }

    // Delete used code
    await query('DELETE FROM auth_codes WHERE id = $1', [authCode.id]);

    // Determine the correct user_id for the session
    let userId = authCode.id; // Default to auth_code id for guests

    if (authCode.role === 'admin' && authCode.email) {
      // For admin users, look up their actual admin_users ID for FK constraint
      const adminUser = await queryOne<{ id: string }>(
        'SELECT id FROM admin_users WHERE email = $1',
        [authCode.email]
      );

      if (adminUser) {
        userId = adminUser.id;
      }
    }

    // Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      await query(
        `INSERT INTO user_sessions (user_id, user_role, session_token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, authCode.role, sessionToken, expiresAt.toISOString()]
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

    // Set user info cookie (non-httpOnly for client-side access)
    const userInfo = {
      id: userId,
      email: authCode.email,
      phone: authCode.phone,
      role: authCode.role,
      eventId: authCode.event_id
    };

    // Non-httpOnly cookie for client-side display only (no sensitive fields)
    const clientUserInfo = {
      email: authCode.email,
      role: authCode.role,
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
      user: userInfo,
      message: authCode.role === 'admin' ? 'Admin login successful' : 'Guest access granted'
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
