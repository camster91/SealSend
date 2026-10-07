import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { resolveSocialAccess, ensureSocialSchema } from '@/lib/social/access';
import { canReadPhoto, privatePhotoPath, deleteSocialPhoto } from '@/lib/social/photos';
import { getSocialSettings } from '@/lib/social/store';
import { queryOne } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/session';
import { getEventAccess, roleCan } from '@/lib/auth/event-access';
type Context = { params: Promise<{ slug: string; id: string }> };
async function viewer(request: Request, slug: string) {
  const access = await resolveSocialAccess(request,slug);
  if (access) return { eventId:access.event.id,guestId:access.guest.id,host:false };
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return null;
  const event = await queryOne<{ id:string }>('SELECT id FROM events WHERE slug=$1',[slug]);
  if (!event) return null;
  const host = await getEventAccess(user.id,event.id);
  return host && roleCan(host.role,'edit_event') ? { eventId:event.id,guestId:null,host:true } : null;
}
const missing = () => NextResponse.json({ error:'Not found' },{ status:404,headers:{ 'Cache-Control':'private, no-store' } });
export async function GET(request: Request, { params }: Context) {
  try {
    const { slug,id } = await params;
    if (!z.uuid().safeParse(id).success) return missing();
    const access = await viewer(request,slug);
    if (!access) return missing();
    await ensureSocialSchema();
    const settings = await getSocialSettings(access.eventId);
    if (!access.host && !settings.photos_enabled) return missing();
    const photo = await queryOne<{ guest_id:string; approved:boolean; storage_path:string }>('SELECT guest_id,approved,storage_path FROM event_social_photos WHERE event_id=$1 AND id=$2',[access.eventId,id]);
    if (!photo || !canReadPhoto(photo.approved,photo.guest_id,access.guestId,access.host)) return missing();
    const file = privatePhotoPath(photo.storage_path);
    if (!file) return missing();
    return new NextResponse(new Uint8Array(await readFile(file)),{ headers:{ 'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',Vary:'Cookie' } });
  } catch { return missing(); }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    const { slug,id } = await params;
    if (!z.uuid().safeParse(id).success) return missing();
    const access = await viewer(request,slug);
    if (!access) return missing();
    await ensureSocialSchema();
    if (!await deleteSocialPhoto(access.eventId,id,access.guestId,access.host)) return missing();
    return NextResponse.json({ success:true },{ headers:{ 'Cache-Control':'private, no-store' } });
  } catch { return NextResponse.json({ error:'Unable to remove the photo.' },{ status:503 }); }
}
