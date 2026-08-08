"use client";

import { useState } from "react";
import type { AiEventDraft } from "@/lib/ai/event-draft-schema";

export function PromptToEventGenerator({ timezone, onApply }: { timezone: string; onApply: (draft: AiEventDraft, generationId: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{ generationId: string; draft: AiEventDraft; fallback: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function generate() {
    setBusy(true); setError(""); setResult(null);
    const response = await fetch("/api/ai/event-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, timezone }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Could not generate a draft."); else setResult(data);
    setBusy(false);
  }
  async function apply() {
    if (!result) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/ai/event-draft/${result.generationId}/outcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "accepted" }) });
    if (!response.ok) { setError("The draft could not be accepted. Generate a fresh draft and try again."); setBusy(false); return; }
    onApply(result.draft, result.generationId); setResult(null); setBusy(false);
  }
  async function reject() {
    if (result) await fetch(`/api/ai/event-draft/${result.generationId}/outcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "rejected" }) });
    setResult(null);
  }
  return <section className="mb-6 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-purple-50 p-5" aria-labelledby="prompt-event-title">
    <h2 id="prompt-event-title" className="text-lg font-bold text-gray-900">Start with an AI-assisted event draft <span className="rounded-full bg-brand-100 px-2 py-1 text-xs text-brand-800">Beta</span></h2>
    <p className="mt-1 text-sm text-gray-600">Describe the event. SealSend will structure a draft for you to review; it will not save, publish, or send anything automatically.</p>
    <label htmlFor="event-prompt" className="mt-4 block text-sm font-semibold">Event idea</label>
    <textarea id="event-prompt" rows={4} maxLength={2000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Client appreciation dinner for 40 people in Toronto on September 18. Business casual, vegetarian options, RSVP deadline two weeks before." className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm" />
    <button type="button" disabled={busy || prompt.trim().length < 20} onClick={() => void generate()} className="mt-3 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Building draft…" : "Build editable draft"}</button>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {result && <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5">
      {result.fallback && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">The AI provider was unavailable, so SealSend created a conservative local draft. Missing facts remain blank.</p>}
      <h3 className="font-bold">{result.draft.event.title}</h3><p className="mt-1 text-sm text-gray-600">{result.draft.event.description}</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Date</dt><dd>{result.draft.event.eventDate || "Needs your input"}</dd></div><div><dt className="font-semibold">Location</dt><dd>{result.draft.event.locationName || "Needs your input"}</dd></div><div><dt className="font-semibold">Capacity</dt><dd>{result.draft.event.maxAttendees || "Not set"}</dd></div><div><dt className="font-semibold">RSVP questions</dt><dd>{result.draft.rsvpFields.length}</dd></div></dl>
      {result.draft.missingInformation.length > 0 && <div className="mt-4"><p className="text-sm font-semibold">Missing information</p><ul className="mt-1 list-disc pl-5 text-sm text-amber-800">{result.draft.missingInformation.map((item) => <li key={item}>{item.replace(/^event\./, "").replace(/([A-Z])/g, " $1").toLowerCase()}</li>)}</ul></div>}
      {result.draft.assumptions.length > 0 && <div className="mt-4"><p className="text-sm font-semibold">Confirm these assumptions after applying</p><ul className="mt-1 space-y-2 text-sm">{result.draft.assumptions.map((item) => <li key={`${item.field}-${item.value}`} className="rounded-lg bg-gray-50 p-2"><strong>{item.field}</strong>: {item.value} — {item.reason}</li>)}</ul></div>}
      <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 text-sm">
        <div><p className="font-semibold">Invitation headline</p><p>{result.draft.invitation.headline}</p></div>
        <div><p className="font-semibold">Invitation message</p><p className="whitespace-pre-wrap text-gray-600">{result.draft.invitation.body}</p></div>
        <div><p className="font-semibold">RSVP questions</p>{result.draft.rsvpFields.length ? <ul className="mt-1 list-disc pl-5">{result.draft.rsvpFields.map((field) => <li key={field.key}>{field.label}{field.required ? " (required)" : ""}</li>)}</ul> : <p className="text-gray-600">No custom questions.</p>}</div>
        <div><p className="font-semibold">Reminder sequence</p>{result.draft.reminders.length ? <ul className="mt-1 space-y-2">{result.draft.reminders.map((reminder) => <li key={`${reminder.timing}-${reminder.subject}`} className="rounded-lg bg-gray-50 p-2"><strong>{reminder.subject}</strong> ({reminder.timing.replaceAll("_", " ")})<br/><span className="text-gray-600">{reminder.message}</span></li>)}</ul> : <p className="text-gray-600">No reminders proposed.</p>}</div>
        <div><p className="font-semibold">Theme direction</p><p className="text-gray-600">{result.draft.theme.style}; {result.draft.theme.imageDirection}</p></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void apply()} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white">Apply to wizard</button><button type="button" disabled={busy} onClick={() => void reject()} className="min-h-11 rounded-xl px-4 text-sm font-medium text-gray-600">Discard</button></div>
    </div>}
  </section>;
}
