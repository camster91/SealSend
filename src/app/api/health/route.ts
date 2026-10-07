import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/client';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    const result = await queryOne<{ ready: number; social_ready: boolean }>(`SELECT 1 AS ready,
      to_regclass('event_social_settings') IS NOT NULL
      AND to_regclass('event_social_guests') IS NOT NULL
      AND to_regclass('event_social_polls') IS NOT NULL
      AND to_regclass('event_social_votes') IS NOT NULL
      AND to_regclass('event_social_photos') IS NOT NULL
      AND to_regclass('event_social_file_cleanup') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='queue_deleted_social_photo'
        AND tgrelid=to_regclass('event_social_photos') AND NOT tgisinternal) AS social_ready`);
    if (result?.ready !== 1 || !result.social_ready) {
      return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
    }

    const sourceCommit = process.env.SOURCE_COMMIT;
    const revision = sourceCommit && /^[a-f0-9]{40}$/.test(sourceCommit) ? sourceCommit : null;
    return NextResponse.json({ status: 'ok', revision, socialSchema: 'ready' }, { headers });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
