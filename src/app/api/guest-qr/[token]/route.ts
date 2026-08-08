import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db/client";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{24}$/.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guest = await queryOne<{ slug: string }>(
    `SELECT e.slug FROM guests g JOIN events e ON e.id = g.event_id
     WHERE g.invite_token = $1 AND e.status = 'published'`, [token],
  );
  if (!guest) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app").replace(/\/$/, "");
  const QRCode = await import("qrcode");
  const buffer = await QRCode.toBuffer(`${siteUrl}/e/${guest.slug}?t=${encodeURIComponent(token)}`, { type: "png", width: 320, margin: 2 });
  const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return new NextResponse(body, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
