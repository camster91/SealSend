import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/client';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    const result = await queryOne<{ ready: number }>('SELECT 1 AS ready');
    if (result?.ready !== 1) {
      return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
    }

    const sourceCommit = process.env.SOURCE_COMMIT;
    const revision = sourceCommit && /^[a-f0-9]{40}$/.test(sourceCommit) ? sourceCommit : null;
    return NextResponse.json({ status: 'ok', revision }, { headers });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
