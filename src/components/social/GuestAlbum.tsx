"use client";
import { useRef, useState } from 'react';
import { useConfirm } from '@/components/ui/Feedback';
import type { SocialState } from '@/lib/social/contracts';
const BUTTON = 'min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50';
export function GuestAlbum({ slug, state, headers, reload }: { slug: string; state: SocialState; headers: Record<string,string>; reload(): Promise<void> }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState('');
  const upload = async (form: HTMLFormElement) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/social/${slug}/photos`, { method: 'POST', headers, body: new FormData(form) });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error || 'Unable to upload.'); return; }
      await reload(); form.reset(); setMessage(state.settings.photo_approval ? 'Uploaded. The host will review your photo.' : 'Your photo is shared.');
    } catch { setMessage('Unable to upload. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const remove = async (id: string) => {
    if (pending.current || !await confirm({ title:'Remove this photo?', description:'This removes the photo from the shared album.',confirmLabel:'Remove photo',tone:'danger' })) return;
    pending.current = true; setBusy(true);
    try {
      const response = await fetch(`/api/social/${slug}/photos/${id}`, { method: 'DELETE', headers });
      if (!response.ok) throw new Error('delete');
      await reload(); setMessage('Photo removed.');
    } catch { setMessage('Unable to remove the photo. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section aria-label="Shared photo album" className="space-y-4">
    <h3 className="font-semibold">Shared photo album</h3>
    <p className="text-sm text-muted-foreground">Photos are visible only to invited guests.{state.settings.photo_approval ? ' The host reviews photos before sharing them.' : ''}</p>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void upload(e.currentTarget); }}>
      <label className="block text-sm font-medium">Photo (JPEG, PNG or WebP, up to 8 MB)<input className="mt-1 block min-h-11 w-full text-sm" type="file" name="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} /></label>
      <label className="block text-sm font-medium">Caption (optional)<input name="caption" maxLength={200} disabled={busy} className="mt-1 min-h-11 w-full rounded-lg border border-border p-3" /></label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="permission" value="yes" required disabled={busy} />I have permission to share this photo with these guests.</label>
      <button className={BUTTON} type="submit" disabled={busy}>{busy ? 'Working…' : 'Upload photo'}</button>
    </form>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{state.photos.map(p => <figure key={p.id} className="min-w-0 space-y-2 rounded-xl border border-border p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/social/${slug}/photos/${p.id}`} alt={p.caption || 'Photo shared by an event guest'} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
      <figcaption className="break-words text-sm">{p.caption}{!p.approved && <span className="block font-medium">Waiting for host approval</span>}</figcaption>
      {p.own && <button type="button" className={BUTTON} disabled={busy} onClick={() => void remove(p.id)}>Remove my photo</button>}
    </figure>)}</div>
    {!state.photos.length && <p className="text-sm">No photos shared yet.</p>}
    <p role="status" className="text-sm">{message}</p>
  </section>;
}
