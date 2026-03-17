import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('sealsend_session')?.value;

    if (sessionToken) {
      await prisma.userSession.deleteMany({
        where: { session_token: sessionToken },
      });
    }

    cookieStore.delete('sealsend_session');
    cookieStore.delete('sealsend_token');
    cookieStore.delete('sealsend_user');

    return NextResponse.json({ success: true, message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
