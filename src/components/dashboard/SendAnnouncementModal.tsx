'use client';

import { announcementOutcome } from "@/lib/announcement-outcome";
import { audienceFor, type UpdateAudience } from "@/lib/messages/update-audience";
import { Modal } from "@/components/ui/Modal";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props { open: boolean; onClose: () => void; eventId: string; onSuccess: () => void; smsEnabled?: boolean }
type Audience = { rsvpStatuses: string[]; invitationStatuses: string[]; tagIds: string[]; unansweredOnly: boolean };

export function SendAnnouncementModal({ open, onClose, eventId, onSuccess, smsEnabled = false }: Props) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>({ rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: false });
  const [channels, setChannels] = useState<Array<'email' | 'sms'>>(['email']);
  const [scheduledAt, setScheduledAt] = useState('');
  const [preview, setPreview] = useState<{ count: number; emailCount: number; smsCount: number; smsSegmentCount: number; approvalProof: string; recipients: Array<{ id: string; name: string; channels: string[] }>; truncated: boolean; estimatedCostMicros: number | null; costConfigured: boolean } | null>(null);
  const [choice, setChoice] = useState<UpdateAudience | null>('everyone');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; sent_to_count: number; scheduled_at: string } | null>(null);
  const outcome = result ? announcementOutcome(result.status, result.sent_to_count ?? 0) : null;
  const [tags, setTags] = useState<Array<{ id: string; tag_name: string; color: string }>>([]);
  const [draftIntent, setDraftIntent] = useState('');
  const [aiDraft, setAiDraft] = useState<{ generationId: string; subject: string; message: string; cautions: string[]; fallback: boolean } | null>(null);
  const [draftTone, setDraftTone] = useState('warm');
  const [draftLength, setDraftLength] = useState('standard');
  const [draftUrgency, setDraftUrgency] = useState('normal');
  const [draftChannel, setDraftChannel] = useState<'email' | 'sms'>('email');

  useEffect(() => {
    if (!open) return;
    void fetch(`/api/events/${eventId}/announcements/audience`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : { tags: [] })
      .then((data) => setTags(data.tags ?? []));
  }, [open, eventId]);

  function reset() { setSubject(''); setMessage(''); setDraftIntent(''); setAiDraft(null); setAudience({ rsvpStatuses: [], invitationStatuses: [], tagIds: [], unansweredOnly: false }); setChannels(['email']); setScheduledAt(''); setChoice('everyone'); setPreview(null); setConfirmed(false); setBusy(false); setError(null); setResult(null); }
  function handleClose() { reset(); onClose(); }
  function choose(next: UpdateAudience) { setChoice(next); setAudience(audienceFor(next)); }
  function editMessage() { setPreview(null); setConfirmed(false); setError(null); }
  function toggleFilter(key: 'rsvpStatuses' | 'invitationStatuses', value: string) {
    setAudience((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
    setChoice(null);
  }
  async function previewAudience() {
    setBusy(true); setError(null); setConfirmed(false);
    const sendAt = scheduledAt ? new Date(scheduledAt).toISOString() : null;
    const response = await fetch(`/api/events/${eventId}/announcements/audience`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: subject.trim(), message: message.trim(), audience, channels, sendAt }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Could not check who gets this. Please try again.');
    else setPreview(data);
    setBusy(false);
  }
  async function draftWithAi() {
    setBusy(true); setError(null); setAiDraft(null);
    const response = await fetch(`/api/events/${eventId}/announcements/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: draftIntent, tone: draftTone, length: draftLength, urgency: draftUrgency, channel: draftChannel }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Could not create a message draft.');
    else setAiDraft({ generationId: data.generationId, ...data.draft, fallback: data.fallback });
    setBusy(false);
  }
  async function recordDraft(generationId: string, data: { outcome?: 'accepted' | 'rejected'; helpful?: boolean }) {
    await fetch(`/api/events/${eventId}/announcements/draft/${generationId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!preview) return void previewAudience();
    if (!preview || !confirmed) return;
    setBusy(true); setError(null);
    const when = scheduledAt ? new Date(scheduledAt).toISOString() : 'now';
    const response = await fetch(`/api/events/${eventId}/announcements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: subject.trim(), message: message.trim(), audience, channels, scheduledAt: when, approved: true, contactConfirmed: true, approvalProof: preview.approvalProof }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Your update could not be sent. Please try again.');
    else { setResult(data); onSuccess(); }
    setBusy(false);
  }
  return <Modal open={open} onClose={handleClose} title={preview && !result ? 'Check your update' : 'Send an update'}>
    {result && outcome ? <div className="text-center" role="status">{outcome.ok ? <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" aria-hidden /> : <AlertTriangle className="mx-auto h-10 w-10 text-accent-red" aria-hidden />}<p className="mt-3 text-lg font-semibold">{outcome.title}</p><p className="mt-1 text-sm text-gray-600">{outcome.detail}</p><Button className="mt-5" onClick={handleClose}>Done</Button></div> :
      <form onSubmit={submit} className="space-y-5">
        {preview ? <div key="review" className="space-y-5">
          <div className="rounded-xl border border-border bg-cotton p-4"><p className="font-semibold text-ink">{subject}</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink">{message}</p></div>
          <p className="text-sm text-ink">{preview.count === 0 ? 'No one on your list matches, so there is nobody to send this to.' : <>This goes to <strong>{preview.count} {preview.count === 1 ? 'guest' : 'guests'}</strong>{scheduledAt ? ` on ${new Date(scheduledAt).toLocaleString()}` : ' now'}.</>}</p>
          {smsEnabled && preview.smsCount > 0 && <p className="text-sm text-ink">{preview.emailCount} by email, {preview.smsCount} by text ({preview.smsSegmentCount} billed SMS segment{preview.smsSegmentCount === 1 ? '' : 's'}). Estimated provider charge: {preview.costConfigured && preview.estimatedCostMicros !== null ? `$${(preview.estimatedCostMicros / 1_000_000).toFixed(4)} USD` : 'not available'}</p>}
          {preview.count > 0 && <details key="recipients"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink">See who gets it</summary><ul className="max-h-48 overflow-y-auto rounded-lg border border-border bg-white p-2 text-sm">{preview.recipients.map((recipient) => <li key={recipient.id} className="border-b px-2 py-2 last:border-0">{recipient.name || 'Unnamed guest'}</li>)}</ul>{preview.truncated && <p className="mt-1 text-xs text-gray-600">Showing the first 100 guests.</p>}</details>}
          <label className="flex min-h-11 items-start gap-3 text-sm text-ink"><input className="mt-0.5 h-5 w-5 shrink-0" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>I&apos;ve checked this message and who gets it. These guests know me and expect to hear from me.</span></label>
        </div> : <div key="write" className="space-y-5">
        <div><label htmlFor="ann-subject" className="text-sm font-medium">Subject</label><input id="ann-subject" required maxLength={200} value={subject} onChange={(e) => { setSubject(e.target.value); }} className="mt-1 h-11 w-full rounded-lg border px-3" /></div>
        <div><label htmlFor="ann-message" className="text-sm font-medium">Message</label><textarea id="ann-message" required maxLength={5000} rows={5} value={message} onChange={(e) => { setMessage(e.target.value); }} className="mt-1 w-full rounded-lg border px-3 py-2" /></div>
        <fieldset><legend className="text-sm font-semibold">Who gets it?</legend><div className="mt-1">{([['everyone', 'Everyone on my list'], ['yes', 'People who said yes'], ['waiting', "People who haven't replied"]] as const).map(([value, label]) => <label key={value} className="flex min-h-11 items-center gap-3 text-sm text-ink"><input type="radio" name="update-audience" className="h-5 w-5" checked={choice === value} onChange={() => choose(value)} />{label}</label>)}</div>{choice === null && <p className="text-sm text-neutral-700">Using the choices under More options.</p>}</fieldset>
        <details key="options" className="rounded-xl border border-border"><summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-ink">More options</summary><div className="space-y-5 border-t border-border p-4">
        <section aria-labelledby="ai-message-heading" className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <h3 id="ai-message-heading" className="font-semibold">Help me write it</h3>
          <p className="mt-1 text-sm text-gray-600">Describe the update and edit the draft before anything is sent.</p>
          <label htmlFor="ann-ai-intent" className="mt-3 block text-sm font-medium">What should guests know?</label>
          <textarea id="ann-ai-intent" rows={3} maxLength={1000} value={draftIntent} onChange={(e) => setDraftIntent(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2" />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><label className="text-xs font-medium">Tone<select value={draftTone} onChange={(e) => setDraftTone(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"><option>warm</option><option>professional</option><option>playful</option><option>formal</option><option>casual</option></select></label><label className="text-xs font-medium">Length<select value={draftLength} onChange={(e) => setDraftLength(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"><option>short</option><option>standard</option><option>detailed</option></select></label><label className="text-xs font-medium">Urgency<select value={draftUrgency} onChange={(e) => setDraftUrgency(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"><option>low</option><option>normal</option><option>high</option></select></label><label className="text-xs font-medium">Draft for<select value={draftChannel} onChange={(e) => setDraftChannel(e.target.value as 'email' | 'sms')} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-2"><option value="email">Email</option>{smsEnabled && <option value="sms">SMS</option>}</select></label></div>
          <Button type="button" variant="outline" className="mt-3" disabled={draftIntent.trim().length < 10} loading={busy} onClick={draftWithAi}>Write a draft</Button>
          {aiDraft && <div className="mt-3 rounded-lg border bg-white p-3 text-sm"><p className="font-semibold">{aiDraft.subject}</p><p className="mt-1 whitespace-pre-wrap text-gray-600">{aiDraft.message}</p>{aiDraft.cautions.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-800">{aiDraft.cautions.map((item) => <li key={item}>{item}</li>)}</ul>}<div className="mt-3 flex flex-wrap gap-2"><Button type="button" onClick={() => { void recordDraft(aiDraft.generationId, { outcome: 'accepted' }); setSubject(aiDraft.subject); setMessage(aiDraft.message); setAiDraft(null); }}>Use this editable draft</Button><Button type="button" variant="outline" onClick={() => void draftWithAi()}>Regenerate</Button><button type="button" className="min-h-11 px-3" onClick={() => void recordDraft(aiDraft.generationId, { helpful: true })} aria-label="Mark draft helpful">Helpful</button><button type="button" className="min-h-11 px-3" onClick={() => void recordDraft(aiDraft.generationId, { helpful: false })} aria-label="Mark draft not helpful">Not helpful</button><button type="button" className="min-h-11 px-3" onClick={() => { void recordDraft(aiDraft.generationId, { outcome: 'rejected' }); setAiDraft(null); }}>Discard</button></div></div>}
        </section>
        <fieldset><legend className="text-sm font-semibold">Reply</legend><div className="mt-2 flex flex-wrap gap-3">{[['attending','Attending'],['maybe','Maybe'],['not_attending','Not attending'],['pending','Pending']].map(([value,label]) => <label key={value} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={audience.rsvpStatuses.includes(value)} onChange={() => toggleFilter('rsvpStatuses', value)} />{label}</label>)}</div></fieldset>
        <fieldset><legend className="text-sm font-semibold">Invitation status</legend><div className="mt-2 flex flex-wrap gap-3">{['not_sent','sent','delivered','failed','bounced','accepted'].map((value) => <label key={value} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={audience.invitationStatuses.includes(value)} onChange={() => toggleFilter('invitationStatuses', value)} />{value.replace('_',' ')}</label>)}</div></fieldset>
        {tags.length > 0 && <fieldset><legend className="text-sm font-semibold">Guest tags</legend><div className="mt-2 flex flex-wrap gap-3">{tags.map((tag) => <label key={tag.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={audience.tagIds.includes(tag.id)} onChange={() => { setAudience((current) => ({ ...current, tagIds: current.tagIds.includes(tag.id) ? current.tagIds.filter((id) => id !== tag.id) : [...current.tagIds, tag.id] })); setChoice(null); }} /><span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />{tag.tag_name}</label>)}</div></fieldset>}
        <fieldset><legend className="text-sm font-semibold">Send by</legend><div className="mt-2 flex gap-5">{(smsEnabled ? (['email','sms'] as const) : (['email'] as const)).map((channel) => <label key={channel} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={channels.includes(channel)} onChange={(e) => { setChannels(e.target.checked ? [...channels, channel] : channels.filter((item) => item !== channel)); }} />{channel === 'email' ? 'Email' : 'Text message'}</label>)}</div></fieldset>
        <div><label htmlFor="ann-schedule" className="text-sm font-medium">Send later (leave empty to send now)</label><input id="ann-schedule" type="datetime-local" value={scheduledAt} onChange={(e) => { setScheduledAt(e.target.value); }} className="mt-1 h-11 w-full rounded-lg border px-3" /></div>
        </div></details>
        </div>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          {preview
            ? <><Button variant="outline" type="button" onClick={editMessage}>Back to edit</Button><Button type="submit" loading={busy} disabled={!confirmed || preview.count === 0}>{scheduledAt ? 'Schedule update' : `Send to ${preview.count} ${preview.count === 1 ? 'guest' : 'guests'}`}</Button></>
            : <><Button variant="outline" type="button" onClick={handleClose}>Cancel</Button><Button type="submit" loading={busy} disabled={!subject.trim() || !message.trim() || channels.length === 0}>Review</Button></>}
        </div>
      </form>}
  </Modal>;
}
