import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { purgeQueuedSocialPhotos } from '@/lib/social/photos';
import { ensureSocialSchema } from '@/lib/social/access';
import { blobKeyFromUploadPath, getBlobStore } from "@/lib/blob-store";

type Asset = { id: string; path: string };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureSocialSchema();
  const socialPhotosDeleted = await purgeQueuedSocialPhotos();
  const enabled = process.env.ENABLE_ORPHAN_UPLOAD_CLEANUP === "true";
  const assets = await query<Asset>(
    `SELECT a.id, a.path FROM upload_assets a
      WHERE a.created_at < NOW() - INTERVAL '7 days'
        AND NOT EXISTS (SELECT 1 FROM events e WHERE e.design_url = a.path)
        AND NOT EXISTS (SELECT 1 FROM event_social_photos p WHERE p.storage_path = a.path)
      ORDER BY a.created_at LIMIT 100`,
  );
  if (!enabled) return NextResponse.json({ enabled: false, candidates: assets.length, deleted: 0, socialPhotosDeleted });

  let deleted = 0;
  const store = getBlobStore();
  for (const asset of assets) {
    const key = blobKeyFromUploadPath(asset.path);
    if (!key) continue;
    try {
      await store.delete(key);
    } catch {
      continue;
    }
    await query("DELETE FROM upload_assets WHERE id = $1", [asset.id]);
    deleted += 1;
  }
  return NextResponse.json({ enabled: true, candidates: assets.length, deleted, socialPhotosDeleted });
}

export const POST = GET;
