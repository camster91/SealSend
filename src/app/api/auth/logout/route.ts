import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db/client';

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sealsend_session')?.value;

  if (sessionToken) {
    try {
      await query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  cookieStore.delete('sealsend_session');
  cookieStore.delete('sealsend_user');

  return NextResponse.json({ success: true });
}
