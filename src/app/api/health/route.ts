import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/client';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    const result = await queryOne<{ ready: number }>('SELECT 1 AS ready');
    if (result?.ready !== 1) {
      return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
    }

    return NextResponse.json({ status: 'ok' }, { headers });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
