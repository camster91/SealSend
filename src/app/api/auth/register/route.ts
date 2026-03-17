import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: rateLimitOk } = await rateLimit(`register:${ip}`, {
      max: 5,
      windowSeconds: 600,
    });

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 },
      );
    }

    const hashed = await hashPassword(password);

    const user = await prisma.adminUser.create({
      data: { email, password: hashed, name: name || null },
    });

    const token = signToken({ userId: user.id, email: user.email, role: 'admin' });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create DB session
    const sessionToken = crypto.randomUUID();
    await prisma.userSession.create({
      data: {
        user_id: user.id,
        user_role: 'admin',
        session_token: sessionToken,
        expires_at: expiresAt,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set('sealsend_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    cookieStore.set('sealsend_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    const userInfo = { id: user.id, email: user.email, name: user.name, role: 'admin' };
    cookieStore.set('sealsend_user', JSON.stringify(userInfo), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: userInfo,
      message: 'Registration successful',
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
