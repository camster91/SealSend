import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { query } from "@/lib/db/client";
import { resolveUploadPath } from "@/lib/upload-path";

type Asset = { id: string; path: string };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const enabled = process.env.ENABLE_ORPHAN_UPLOAD_CLEANUP === "true";
  const assets = await query<Asset>(
    `SELECT a.id, a.path FROM upload_assets a
      WHERE a.created_at < NOW() - INTERVAL '7 days'
        AND NOT EXISTS (SELECT 1 FROM events e WHERE e.design_url = a.path)
      ORDER BY a.created_at LIMIT 100`,
  );
  if (!enabled) return NextResponse.json({ enabled: false, candidates: assets.length, deleted: 0 });

  let deleted = 0;
  const uploadsDir = path.join(process.cwd(), "uploads");
  for (const asset of assets) {
    const segments = asset.path.replace(/^\/uploads\//, "").split("/");
    try {
      const resolved = resolveUploadPath(uploadsDir, segments);
      if (!resolved) continue;
      await unlink(resolved);
    } catch (error) {
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code !== "ENOENT") continue;
    }
    await query("DELETE FROM upload_assets WHERE id = $1", [asset.id]);
    deleted += 1;
  }
  return NextResponse.json({ enabled: true, candidates: assets.length, deleted });
}

export const POST = GET;
