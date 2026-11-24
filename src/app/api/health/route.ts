import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/client';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    // social_ready is computed, so it comes back as 0/1 rather than a boolean.
    const result = await queryOne<{ ready: number; social_ready: number }>(`SELECT 1 AS ready,
      (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (
        'event_social_settings', 'event_social_guests', 'event_social_polls',
        'event_social_votes', 'event_social_photos', 'event_social_file_cleanup')) = 6
      AND EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = 'queue_deleted_social_photo'
        AND tbl_name = 'event_social_photos') AS social_ready`);
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
