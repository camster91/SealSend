import { NextResponse } from 'next/server';
import { resolveSocialAccess, ensureSocialSchema } from '@/lib/social/access';
import { normalizePhoto, readBoundedBody, saveSocialPhoto, MAX_PHOTO_BYTES } from '@/lib/social/photos';
import { rateLimit } from '@/lib/rate-limit';
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const access = await resolveSocialAccess(request,slug);
    if (!access) return NextResponse.json({ error:'Open your personal invitation first.' },{ status:403 });
    const limit = await rateLimit(`social-photo:${access.event.id}:${access.guest.id}`,{ max:12,windowSeconds:3600 });
    if (!limit.success) return NextResponse.json({ error:'Please try again later.' },{ status:429 });
    const bytes = await readBoundedBody(request);
    if (!bytes) return NextResponse.json({ error:'Choose a photo smaller than 8 MB.' },{ status:413 });
    const form = await new Response(new Uint8Array(bytes),{ headers:{ 'Content-Type':request.headers.get('content-type') ?? '' } }).formData();
    const file = form.get('file'), caption = form.get('caption') ?? '';
    if (!(file instanceof File) || file.size > MAX_PHOTO_BYTES || typeof caption !== 'string' || caption.trim().length > 200 || form.get('permission') !== 'yes') {
      return NextResponse.json({ error:'Choose a photo and confirm permission to share it.' },{ status:400 });
    }
    const normalized = await normalizePhoto(Buffer.from(await file.arrayBuffer()),file.type);
    if (!normalized) return NextResponse.json({ error:'Choose a valid JPEG, PNG or WebP photo.' },{ status:400 });
    await ensureSocialSchema();
    const result = await saveSocialPhoto(access,normalized,caption.trim());
    return NextResponse.json(result,{ status:result.status,headers:{ 'Cache-Control':'private, no-store' } });
  } catch { return NextResponse.json({ error:'Unable to upload this photo.' },{ status:503 }); }
}
