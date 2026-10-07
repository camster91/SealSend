"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SocialState, SocialSettings } from '@/lib/social/contracts';
const BUTTON = 'min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50';
const FEATURES: { key:keyof SocialSettings; label:string }[] = [
  { key:'guests_enabled',label:"Who's coming (guests choose to share their name)" },
  { key:'reactions_enabled',label:'Reactions and excitement' },
  { key:'polls_enabled',label:'Guest polls' }, { key:'photos_enabled',label:'Shared photo album' },
  { key:'countdown_enabled',label:'Event countdown' }, { key:'photo_approval',label:'Review guest photos before sharing' },
];
export function HostSocial({ eventId, slug }: { eventId:string; slug:string }) {
  const [state,setState] = useState<SocialState>();
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const pending = useRef(false);
  const reload = useCallback(async () => {
    const response = await fetch(`/api/events/${eventId}/social`,{ cache:'no-store' });
    if (!response.ok) throw new Error('load');
    setState(await response.json());
  },[eventId]);
  useEffect(() => { void reload().catch(() => setMessage('Event activities are unavailable right now.')); },[reload]);
  const act = async (action:object): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/events/${eventId}/social`,{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify(action) });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error || 'Unable to save.'); return false; }
      await reload(); setMessage('Saved.'); return true;
    } catch { setMessage('Unable to save. Please try again.'); return false; }
    finally { pending.current = false; setBusy(false); }
  };
  const addPoll = async (form:HTMLFormElement) => {
    const data = new FormData(form);
    const saved = await act({ action:'poll',poll:{ question:data.get('question'),options:String(data.get('options')).split('\n').map(s=>s.trim()).filter(Boolean) } });
    if (saved) form.reset();
  };
  return <section className="rounded-2xl border border-border bg-white p-5 text-ink" aria-label="Guest activities">
    <h2 className="text-lg font-semibold">Guest activities</h2>
    <p className="mt-2 text-sm text-muted-foreground">Only verified invited guests can join in. Their contact details are never shared.</p>
    {state && <div className="mt-4 space-y-5">
      <fieldset disabled={busy} className="space-y-1"><legend className="sr-only">Enabled activities</legend>{FEATURES.map(f=><label key={f.key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={state.settings[f.key]} onChange={e=>void act({ action:'settings',settings:{ ...state.settings,[f.key]:e.target.checked } })} />{f.label}</label>)}</fieldset>
      {state.settings.polls_enabled && <form onSubmit={e=>{ e.preventDefault(); void addPoll(e.currentTarget); }} className="space-y-3 border-t border-border pt-4">
        <h3 className="font-semibold">Add a poll</h3>
        <label className="block text-sm">Question<input name="question" required maxLength={200} disabled={busy} className="mt-1 min-h-11 w-full rounded-lg border border-border p-3" /></label>
        <label className="block text-sm">Options (2–6, one per line)<textarea name="options" required rows={3} maxLength={486} disabled={busy} className="mt-1 w-full rounded-lg border border-border p-3" /></label>
        <button className={BUTTON} disabled={busy} type="submit">Add poll</button>
      </form>}
      {state.polls.map(p=><div key={p.id} className="space-y-2 border-t border-border pt-4"><h3 className="break-words font-semibold">{p.question}</h3><ul className="text-sm">{p.options.map((o,i)=><li key={i} className="break-words">{o}: {p.counts[i]} votes</li>)}</ul><button className={BUTTON} disabled={busy} type="button" onClick={()=>void act({ action:'close_poll',id:p.id,closed:!p.closed })}>{p.closed ? 'Reopen poll' : 'Close poll'}</button></div>)}
      {state.photos.length > 0 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{state.photos.map(p=><figure key={p.id} className="min-w-0 space-y-2 rounded-xl border border-border p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/social/${slug}/photos/${p.id}`} alt={p.caption || 'Guest photo awaiting review'} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
        <figcaption className="break-words text-sm">{p.caption || 'Guest photo'} · {p.approved ? 'Shared' : 'Awaiting review'}</figcaption>
        <div className="flex flex-wrap gap-2">{!p.approved && <button className={BUTTON} disabled={busy} type="button" onClick={()=>void act({ action:'approve_photo',id:p.id })}>Approve photo</button>}<button className={BUTTON} disabled={busy} type="button" onClick={()=>{ if(window.confirm('Remove this photo from the album?')) void act({ action:'delete_photo',id:p.id }); }}>Remove photo</button></div>
      </figure>)}</div>}
    </div>}
    <p role="status" className="mt-3 text-sm">{message || (!state ? 'Loading activities…' : '')}</p>
  </section>;
}
