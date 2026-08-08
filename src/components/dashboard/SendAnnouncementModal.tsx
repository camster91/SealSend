'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X, CheckCircle2 } from 'lucide-react';

interface Props { open: boolean; onClose: () => void; eventId: string; onSuccess: () => void }
type Audience = { rsvpStatuses: string[]; invitationStatuses: string[]; tagIds: string[]; unansweredOnly: boolean };

export function SendAnnouncementModal({ open, onClose, eventId, onSuccess }: Props) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>({ rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: false });
  const [channels, setChannels] = useState<Array<'email' | 'sms'>>(['email']);
  const [scheduledAt, setScheduledAt] = useState('');
  const [preview, setPreview] = useState<{ count: number; emailCount: number; smsCount: number } | null>(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; sent_to_count: number; scheduled_at: string } | null>(null);
  const [tags, setTags] = useState<Array<{ id: string; tag_name: string; color: string }>>([]);
  const [draftIntent, setDraftIntent] = useState('');
  const [aiDraft, setAiDraft] = useState<{ subject: string; message: string; cautions: string[]; fallback: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    void fetch(`/api/events/${eventId}/announcements/audience`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : { tags: [] })
      .then((data) => setTags(data.tags ?? []));
  }, [open, eventId]);

  function reset() { setSubject(''); setMessage(''); setDraftIntent(''); setAiDraft(null); setAudience({ rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: false }); setChannels(['email']); setScheduledAt(''); setPreview(null); setApproved(false); setBusy(false); setError(null); setResult(null); }
  function handleClose() { reset(); onClose(); }
  function toggleFilter(key: 'rsvpStatuses' | 'invitationStatuses', value: string) {
    setAudience((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
    setPreview(null); setApproved(false);
  }
  async function previewAudience() {
    setBusy(true); setError(null);
    const response = await fetch(`/api/events/${eventId}/announcements/audience`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(audience) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Could not resolve recipients.');
    else setPreview(data);
    setBusy(false);
  }
  async function draftWithAi() {
    setBusy(true); setError(null); setAiDraft(null);
    const response = await fetch(`/api/events/${eventId}/announcements/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: draftIntent, tone: 'warm' }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Could not create a message draft.');
    else setAiDraft({ ...data.draft, fallback: data.fallback });
    setBusy(false);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!preview || !approved) return;
    setBusy(true); setError(null);
    const when = scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString();
    const response = await fetch(`/api/events/${eventId}/announcements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: subject.trim(), message: message.trim(), audience, channels, scheduledAt: when, approved: true }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Could not queue announcement.');
    else { setResult(data); onSuccess(); }
    setBusy(false);
  }
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="announcement-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-6 py-4"><h2 id="announcement-title" className="text-lg font-semibold">Plan announcement</h2><button aria-label="Close announcement modal" onClick={handleClose} className="min-h-11 min-w-11 rounded-lg p-2"><X className="h-5 w-5" /></button></div>
      <div className="p-6">{result ? <div className="text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-green-500" /><p className="mt-3 text-lg font-semibold">{result.status === 'queued' ? 'Announcement scheduled' : 'Dispatch completed'}</p><p className="mt-1 text-sm text-gray-600">Status: {result.status}. Accepted deliveries: {result.sent_to_count ?? 0}.</p><Button className="mt-5" onClick={handleClose}>Done</Button></div> :
      <form onSubmit={submit} className="space-y-5">
        <section aria-labelledby="ai-message-heading" className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <h3 id="ai-message-heading" className="font-semibold">AI-assisted message draft <span className="text-xs text-brand-700">Beta</span></h3>
          <p className="mt-1 text-sm text-gray-600">Describe the update. Nothing is sent or scheduled until you review the final content, audience, channels, and schedule.</p>
          <label htmlFor="ann-ai-intent" className="mt-3 block text-sm font-medium">What should guests know?</label>
          <textarea id="ann-ai-intent" rows={3} maxLength={1000} value={draftIntent} onChange={(e) => setDraftIntent(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2" />
          <Button type="button" variant="outline" className="mt-3" disabled={draftIntent.trim().length < 10} loading={busy} onClick={draftWithAi}>Create review draft</Button>
          {aiDraft && <div className="mt-3 rounded-lg border bg-white p-3 text-sm"><p className="font-semibold">{aiDraft.subject}</p><p className="mt-1 whitespace-pre-wrap text-gray-600">{aiDraft.message}</p>{aiDraft.cautions.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-800">{aiDraft.cautions.map((item) => <li key={item}>{item}</li>)}</ul>}<Button type="button" className="mt-3" onClick={() => { setSubject(aiDraft.subject); setMessage(aiDraft.message); setApproved(false); setAiDraft(null); }}>Use this editable draft</Button></div>}
        </section>
        <div><label htmlFor="ann-subject" className="text-sm font-medium">Subject</label><input id="ann-subject" required maxLength={200} value={subject} onChange={(e) => { setSubject(e.target.value); setApproved(false); }} className="mt-1 h-11 w-full rounded-lg border px-3" /></div>
        <div><label htmlFor="ann-message" className="text-sm font-medium">Message</label><textarea id="ann-message" required maxLength={5000} rows={5} value={message} onChange={(e) => { setMessage(e.target.value); setApproved(false); }} className="mt-1 w-full rounded-lg border px-3 py-2" /></div>
        <fieldset><legend className="text-sm font-semibold">Target RSVP state</legend><div className="mt-2 flex flex-wrap gap-3">{[['attending','Attending'],['maybe','Maybe'],['not_attending','Not attending'],['pending','Pending']].map(([value,label]) => <label key={value} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={audience.rsvpStatuses.includes(value)} onChange={() => toggleFilter('rsvpStatuses', value)} />{label}</label>)}</div></fieldset>
        <fieldset><legend className="text-sm font-semibold">Target invitation state</legend><div className="mt-2 flex flex-wrap gap-3">{['not_sent','sent','delivered','failed','bounced','accepted'].map((value) => <label key={value} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={audience.invitationStatuses.includes(value)} onChange={() => toggleFilter('invitationStatuses', value)} />{value.replace('_',' ')}</label>)}</div></fieldset>
        {tags.length > 0 && <fieldset><legend className="text-sm font-semibold">Target guest tags</legend><div className="mt-2 flex flex-wrap gap-3">{tags.map((tag) => <label key={tag.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={audience.tagIds.includes(tag.id)} onChange={() => { setAudience((current) => ({ ...current, tagIds: current.tagIds.includes(tag.id) ? current.tagIds.filter((id) => id !== tag.id) : [...current.tagIds, tag.id] })); setPreview(null); setApproved(false); }} /><span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />{tag.tag_name}</label>)}</div></fieldset>}
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={audience.unansweredOnly} onChange={(e) => { setAudience({ ...audience, unansweredOnly: e.target.checked }); setPreview(null); setApproved(false); }} />Only guests without an RSVP response</label>
        <fieldset><legend className="text-sm font-semibold">Channels</legend><div className="mt-2 flex gap-5">{(['email','sms'] as const).map((channel) => <label key={channel} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={channels.includes(channel)} onChange={(e) => { setChannels(e.target.checked ? [...channels, channel] : channels.filter((item) => item !== channel)); setApproved(false); }} />{channel.toUpperCase()}</label>)}</div></fieldset>
        <div><label htmlFor="ann-schedule" className="text-sm font-medium">Schedule (leave empty to send now)</label><input id="ann-schedule" type="datetime-local" value={scheduledAt} onChange={(e) => { setScheduledAt(e.target.value); setApproved(false); }} className="mt-1 h-11 w-full rounded-lg border px-3" /></div>
        <Button type="button" variant="outline" onClick={previewAudience} loading={busy}>Preview audience</Button>
        {preview && <div className="rounded-xl bg-brand-50 p-4"><p className="font-semibold">Resolved audience: {preview.count} guests</p><p className="text-sm text-gray-600">{preview.emailCount} with email · {preview.smsCount} with SMS</p><label className="mt-3 flex items-start gap-2"><input className="mt-1" type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /><span className="text-sm">I reviewed the final content, audience, channels, and schedule and approve this external send.</span></label></div>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" type="button" onClick={handleClose}>Cancel</Button><Button type="submit" loading={busy} disabled={!approved || !preview || channels.length === 0 || preview.count === 0}>{scheduledAt ? 'Schedule approved message' : 'Send approved message'}</Button></div>
      </form>}</div>
    </div>
  </div>;
}
