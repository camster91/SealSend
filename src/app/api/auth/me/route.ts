import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();

    // Try JWT token first
    const token = cookieStore.get('sealsend_token')?.value;
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        const user = await prisma.adminUser.findUnique({
          where: { id: payload.userId },
          select: { id: true, email: true, name: true },
        });

        if (user) {
          return NextResponse.json({
            user: { id: user.id, email: user.email, name: user.name, role: 'admin' },
          });
        }
      }
    }

    // Fall back to session token
    const sessionToken = cookieStore.get('sealsend_session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const session = await prisma.userSession.findUnique({
      where: { session_token: sessionToken },
      include: { admin_user: { select: { id: true, email: true, name: true } } },
    });

    if (!session || session.expires_at < new Date()) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.admin_user.id,
        email: session.admin_user.email,
        name: session.admin_user.name,
        role: session.user_role,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
