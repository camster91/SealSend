"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { GuestAlbum } from './GuestAlbum';
import type { SocialState } from '@/lib/social/contracts';
const BUTTON = 'min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50';
const REACTIONS = [{ value: 'excited', label: "I'm excited" }, { value: 'love', label: 'Love this' }, { value: 'celebrate', label: 'Celebrate' }];
export function GuestSocial({ slug, token }: { slug: string; token?: string }) {
  const [state, setState] = useState<SocialState>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const headers = useCallback((): Record<string,string> => token ? { 'X-Guest-Token': token } : {}, [token]);
  const reload = useCallback(async () => {
    const response = await fetch(`/api/social/${slug}`, { headers: headers(), cache: 'no-store' });
    if (response.status === 403) return;
    if (!response.ok) throw new Error('load');
    setState(await response.json());
  }, [slug, headers]);
  useEffect(() => { void reload().catch(() => setMessage('Event activities are unavailable right now.')); }, [reload]);
  const act = async (data: object) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/social/${slug}`, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!response.ok) throw new Error('save');
      await reload(); setMessage('Saved.');
    } catch { setMessage('Unable to save. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };
  if (!state) return <p className="text-sm text-muted-foreground" aria-live="polite">{message || 'Open your personal invitation to join event activities.'}</p>;
  const s = state.settings;
  if (!s.guests_enabled && !s.reactions_enabled && !s.polls_enabled && !s.photos_enabled && !s.countdown_enabled) return null;
  return <section aria-label="Event activities" className="space-y-6 rounded-xl border border-border bg-white p-5 text-ink">
    <h2 className="font-display text-2xl">Join in</h2>
    {s.countdown_enabled && <EventCountdown date={state.event_date} />}
    {s.guests_enabled && <section aria-label="Who's coming" className="space-y-3">
      <h3 className="font-semibold">Who&apos;s coming</h3>
      <p className="text-sm text-muted-foreground">Only guests who choose to share their name appear here.</p>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={state.mine.show_name} disabled={busy} onChange={e => void act({ action: 'visibility', show_name: e.target.checked })} />Show my name to other invited guests when I&apos;m attending</label>
      {state.guests.length ? <ul className="flex flex-wrap gap-2">{state.guests.map((g,i) => <li key={i} className="max-w-full break-words rounded-full bg-cotton px-3 py-2 text-sm">{g.name}</li>)}</ul> : <p className="text-sm">No shared names yet.</p>}
    </section>}
    {s.reactions_enabled && <section aria-label="Event reactions" className="space-y-3">
      <h3 className="font-semibold">Looking forward to it?</h3>
      <div className="flex flex-wrap gap-2">{REACTIONS.map(r => <button key={r.value} type="button" className={BUTTON} aria-pressed={state.mine.reaction === r.value} disabled={busy} onClick={() => void act({ action: 'reaction', reaction: state.mine.reaction === r.value ? null : r.value })}>{r.label} · {state.reactions[r.value] ?? 0}</button>)}</div>
    </section>}
    {s.polls_enabled && state.polls.map(p => <fieldset key={p.id} className="space-y-2" disabled={busy || p.closed}>
      <legend className="mb-2 break-words font-semibold">{p.question}{p.closed ? ' (closed)' : ''}</legend>
      {p.options.map((o,i) => <label key={i} className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="radio" name={`poll-${p.id}`} checked={p.choice === i} onChange={() => void act({ action: 'vote', poll_id: p.id, option_index: i })} /><span className="min-w-0 flex-1 break-words">{o}</span><span>{p.counts[i]} {p.counts[i] === 1 ? 'vote' : 'votes'}</span></label>)}
    </fieldset>)}
    {s.photos_enabled && <GuestAlbum slug={slug} state={state} headers={headers()} reload={reload} />}
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
  </section>;
}
function EventCountdown({ date }: { date: string | null }) {
  const [now, setNow] = useState<number>();
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const id = setInterval(tick, 60000); return () => clearInterval(id); }, []);
  if (!date || now === undefined) return null;
  const delta = new Date(date).getTime() - now;
  if (!Number.isFinite(delta)) return null;
  const days = Math.floor(delta / 86400000), hours = Math.floor((delta % 86400000) / 3600000);
  return <p className="rounded-lg bg-cotton p-4 text-sm font-medium">{delta <= 0 ? 'The event has started.' : `${days} ${days === 1 ? 'day' : 'days'}, ${hours} ${hours === 1 ? 'hour' : 'hours'} to go`}</p>;
}
