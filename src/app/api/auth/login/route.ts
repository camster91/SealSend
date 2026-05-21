import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, signToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: rateLimitOk } = await rateLimit(`login:${ip}`, {
      max: 5,
      windowSeconds: 600,
    });

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, password: true },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(password, adminUser.password);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    const token = signToken({ userId: adminUser.id, email: adminUser.email, role: 'admin' });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const sessionToken = crypto.randomUUID();
    await prisma.userSession.create({
      data: {
        user_id: adminUser.id,
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

    const userInfo = { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: 'admin' };
    cookieStore.set('sealsend_user', JSON.stringify(userInfo), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: userInfo,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
