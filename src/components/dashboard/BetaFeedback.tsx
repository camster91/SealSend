"use client";

import { useState } from "react";

export function BetaFeedback() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("setup");
  const [message, setMessage] = useState("");
  const [mayContact, setMayContact] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("");
    const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, category, message, mayContact }) });
    const data = await response.json();
    setStatus(response.ok ? "Thank you. Your feedback was recorded." : data.error || "Feedback could not be recorded.");
    if (response.ok) { setMessage(""); setRating(0); }
    setBusy(false);
  }
  return <aside className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-5" aria-labelledby="beta-feedback-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="beta-feedback-title" className="font-semibold text-gray-900">Help shape the SealSend beta</h2><p className="mt-1 text-sm text-gray-600">Independent planners, community organizers, and small teams: tell us where your real workflow slows down.</p></div><button type="button" className="min-h-11 rounded-lg border border-brand-300 bg-white px-4 text-sm font-semibold text-brand-800" aria-expanded={open} aria-controls="beta-feedback-form" onClick={() => setOpen((value) => !value)}>{open ? "Close feedback" : "Share feedback"}</button></div>
    {open && <form id="beta-feedback-form" className="mt-5 space-y-4" onSubmit={submit}>
      <div><label htmlFor="feedback-category" className="text-sm font-medium">Area</label><select id="feedback-category" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border bg-white px-3"><option value="setup">Event setup</option><option value="ai_draft">AI draft</option><option value="guest_management">Guest management</option><option value="communications">Communications</option><option value="check_in">Check-in</option><option value="other">Other</option></select></div>
      <fieldset><legend className="text-sm font-medium">How useful was this workflow?</legend><div className="mt-2 flex gap-2">{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-pressed={rating === value} onClick={() => setRating(value)} className={`min-h-11 min-w-11 rounded-lg border ${rating === value ? "border-brand-600 bg-brand-600 text-white" : "bg-white"}`}>{value}</button>)}</div></fieldset>
      <div><label htmlFor="feedback-message" className="text-sm font-medium">What happened, and what would have helped?</label><textarea id="feedback-message" required minLength={5} maxLength={2000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2" /></div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={mayContact} onChange={(event) => setMayContact(event.target.checked)} />SealSend may contact me about this feedback.</label>
      <button disabled={busy || !rating || message.trim().length < 5} className="min-h-11 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Recording…" : "Send feedback"}</button>
      {status && <p role="status" className="text-sm text-gray-700">{status}</p>}
      <p className="text-xs text-gray-500">For direct help, email <a className="underline" href="mailto:support@sealsend.app">support@sealsend.app</a>.</p>
    </form>}
  </aside>;
}
