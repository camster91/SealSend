import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: rateLimitOk } = rateLimit(`verify-code:${ip}`, { max: 10, windowSeconds: 600 });
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes before trying again.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { method, email, phone, code, eventId } = body;

    if (!method || !code || (!email && !phone)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS - auth operations happen before user is authenticated
    const supabase = createAdminClient();

    // Verify code
    const { data: authCode, error: codeError } = await supabase
      .from('auth_codes')
      .select('*')
      .eq(method === 'email' ? 'email' : 'phone', method === 'email' ? email : phone)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (codeError || !authCode) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 401 }
      );
    }

    // Delete used code
    await supabase.from('auth_codes').delete().eq('id', authCode.id);

    // Determine the correct user_id for the session
    let userId = authCode.id; // Default to auth_code id for guests

    if (authCode.role === 'admin' && authCode.email) {
      // For admin users, look up their actual admin_users ID for FK constraint
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', authCode.email)
        .single();

      if (adminUser) {
        userId = adminUser.id;
      }
    }

    // Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        user_role: authCode.role,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString()
      });

    if (sessionError) {
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

    cookieStore.set('sealsend_user', JSON.stringify(userInfo), {
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
