import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireEventPermission } from '@/lib/auth/event-api-access';
import { queryOne } from '@/lib/db/client';
import { ensureSocialSchema } from '@/lib/social/access';
import { loadSocialState } from '@/lib/social/store';
import { hostActionSchema } from '@/lib/social/contracts';
import { applyHostAction, socialTransaction } from '@/lib/social/actions';
import { deleteSocialPhoto } from '@/lib/social/photos';
import { rateLimit } from '@/lib/rate-limit';
type Context = { params: Promise<{ eventId:string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const { eventId } = await params;
    if (!z.uuid().safeParse(eventId).success) return NextResponse.json({ error:'Not found' },{ status:404 });
    const auth = await requireEventPermission(eventId,'edit_event');
    if (auth.error) return auth.error;
    const event = await queryOne<{ event_date:string | null }>('SELECT event_date FROM events WHERE id=$1',[eventId]);
    if (!event) return NextResponse.json({ error:'Not found' },{ status:404 });
    await ensureSocialSchema();
    return NextResponse.json(await loadSocialState(eventId,null,event.event_date,true),{ headers:{ 'Cache-Control':'private, no-store' } });
  } catch { return NextResponse.json({ error:'Unable to load event activities.' },{ status:503 }); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const { eventId } = await params;
    if (!z.uuid().safeParse(eventId).success) return NextResponse.json({ error:'Not found' },{ status:404 });
    const auth = await requireEventPermission(eventId,'edit_event');
    if (auth.error) return auth.error;
    const event = await queryOne<{ status:string }>('SELECT status FROM events WHERE id=$1',[eventId]);
    if (!event || event.status === 'archived') return NextResponse.json({ error:'This event is archived.' },{ status:409 });
    const limit = await rateLimit(`social-host:${eventId}:${auth.user.id}`,{ max:60,windowSeconds:60 });
    if (!limit.success) return NextResponse.json({ error:'Please try again shortly.' },{ status:429 });
    const parsed = hostActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error:'Check the activity details.' },{ status:400 });
    await ensureSocialSchema();
    const action = parsed.data;
    const result = action.action === 'delete_photo'
      ? await deleteSocialPhoto(eventId,action.id,null,true)
      : await socialTransaction(eventId,db => applyHostAction(eventId,action,db));
    if (!result) return NextResponse.json({ error:'Activity not found or limit reached.' },{ status:409 });
    return NextResponse.json({ success:true },{ headers:{ 'Cache-Control':'private, no-store' } });
  } catch { return NextResponse.json({ error:'Unable to save event activities.' },{ status:503 }); }
}
