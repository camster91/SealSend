import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: rateLimitOk } = await rateLimit(`verify-code:${ip}`, { max: 10, windowSeconds: 600 });
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

    // Verify code
    const whereClause: Record<string, unknown> = {
      code,
      expires_at: { gt: new Date() },
    };
    if (method === 'email') {
      whereClause.email = email;
    } else {
      whereClause.phone = phone;
    }

    const authCode = await prisma.authCode.findFirst({ where: whereClause });

    if (!authCode) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 401 }
      );
    }

    // Delete used code
    await prisma.authCode.delete({ where: { id: authCode.id } });

    // Determine the correct user_id for the session
    let userId = authCode.id; // Default to auth_code id for guests

    if (authCode.role === 'admin' && authCode.email) {
      const adminUser = await prisma.adminUser.findUnique({
        where: { email: authCode.email },
        select: { id: true },
      });
      if (adminUser) {
        userId = adminUser.id;
      }
    }

    // Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        user_id: userId,
        user_role: authCode.role,
        session_token: sessionToken,
        expires_at: expiresAt,
      },
    });

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
