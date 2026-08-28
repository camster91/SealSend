"use client";

import { useState } from "react";
import type { AiEventDraft } from "@/lib/ai/event-draft-schema";
import { eventBriefSchema, type EventBrief } from "@/lib/event-brief";
import { zonedLocalDateTimeToInstant } from "@/lib/datetime";

type Result = { generationId: string; draft: AiEventDraft; brief: EventBrief; fallback: boolean };

export function PromptToEventGenerator({ timezone, onApply }: {
  timezone: string;
  onApply: (draft: AiEventDraft, generationId: string, brief: EventBrief) => void;
}) {
  const [summary, setSummary] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [locationName, setLocationName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [audience, setAudience] = useState("");
  const [accessibilityStatus, setAccessibilityStatus] = useState<EventBrief["accessibilityStatus"]>("not_reviewed");
  const [accessibilityNotes, setAccessibilityNotes] = useState("");
  const [communicationPreference, setCommunicationPreference] = useState<EventBrief["communicationPreference"]>("undecided");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function buildBrief(): EventBrief | null {
    let instant: string | null = null;
    try {
      instant = eventDate ? zonedLocalDateTimeToInstant(eventDate, timezone) : null;
    } catch {
      setError("Enter a valid event date and time.");
      return null;
    }
    const parsed = eventBriefSchema.safeParse({
      summary,
      eventDate: instant,
      locationName: locationName.trim() || null,
      maxAttendees: capacity ? Number(capacity) : null,
      audience,
      accessibilityStatus,
      accessibilityNotes: accessibilityNotes.trim() || null,
      communicationPreference,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Complete the event brief before generating.");
      return null;
    }
    return parsed.data;
  }

  async function generate() {
    setError(""); setResult(null);
    const brief = buildBrief();
    if (!brief) return;
    setBusy(true);
    try {
      const response = await fetch("/api/ai/event-draft", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief, timezone }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Could not generate a draft.");
      else setResult(data);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!result) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/ai/event-draft/${result.generationId}/outcome`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "accepted" }),
    });
    if (!response.ok) {
      setError("The draft could not be accepted. Generate a fresh draft and try again.");
      setBusy(false);
      return;
    }
    onApply(result.draft, result.generationId, result.brief);
    setResult(null); setBusy(false);
  }

  async function reject() {
    if (result) await fetch(`/api/ai/event-draft/${result.generationId}/outcome`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "rejected" }),
    });
    setResult(null);
  }

  const inputClass = "mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm";
  return <section className="mb-6 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-purple-50 p-5" aria-labelledby="prompt-event-title">
    <h2 id="prompt-event-title" className="text-lg font-bold text-gray-900">Start with an AI-assisted event draft <span className="rounded-full bg-brand-100 px-2 py-1 text-xs text-brand-800">Beta</span></h2>
    <p className="mt-1 text-sm text-gray-600">Create a reviewed event brief first. SealSend uses your explicit decisions to build an editable draft; it never saves, publishes, or sends automatically.</p>
    <label htmlFor="event-summary" className="mt-4 block text-sm font-semibold">Event purpose</label>
    <textarea id="event-summary" rows={3} maxLength={2000} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="A monthly community dinner for neighbourhood volunteers to reconnect and welcome new helpers." className={inputClass} />
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div><label htmlFor="brief-date" className="block text-sm font-semibold">Date and time <span className="font-normal text-gray-500">(optional for draft)</span></label><input id="brief-date" type="datetime-local" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={inputClass} /></div>
      <div><label htmlFor="brief-location" className="block text-sm font-semibold">Location <span className="font-normal text-gray-500">(optional for draft)</span></label><input id="brief-location" value={locationName} maxLength={200} onChange={(event) => setLocationName(event.target.value)} className={inputClass} /></div>
      <div><label htmlFor="brief-capacity" className="block text-sm font-semibold">Capacity <span className="font-normal text-gray-500">(optional for draft)</span></label><input id="brief-capacity" type="number" min="1" max="10000" value={capacity} onChange={(event) => setCapacity(event.target.value)} className={inputClass} /></div>
      <div><label htmlFor="brief-audience" className="block text-sm font-semibold">Intended audience</label><input id="brief-audience" value={audience} maxLength={500} onChange={(event) => setAudience(event.target.value)} className={inputClass} /></div>
      <div><label htmlFor="brief-accessibility" className="block text-sm font-semibold">Accessibility review</label><select id="brief-accessibility" value={accessibilityStatus} onChange={(event) => setAccessibilityStatus(event.target.value as EventBrief["accessibilityStatus"])} className={inputClass}><option value="not_reviewed">Not reviewed yet</option><option value="no_known_requirements">No known requirements</option><option value="requirements_known">Requirements identified</option></select></div>
      <div><label htmlFor="brief-communication" className="block text-sm font-semibold">Communication plan</label><select id="brief-communication" value={communicationPreference} onChange={(event) => setCommunicationPreference(event.target.value as EventBrief["communicationPreference"])} className={inputClass}><option value="undecided">Not decided yet</option><option value="email">Email</option><option value="sms">SMS</option><option value="email_and_sms">Email and SMS</option><option value="none">No messages planned</option></select></div>
    </div>
    {accessibilityStatus === "requirements_known" && <div className="mt-3"><label htmlFor="brief-accessibility-notes" className="block text-sm font-semibold">Accessibility requirements</label><textarea id="brief-accessibility-notes" rows={2} maxLength={1000} value={accessibilityNotes} onChange={(event) => setAccessibilityNotes(event.target.value)} className={inputClass} /></div>}
    <p className="mt-3 text-xs text-gray-600">Any blank schedule, location, or capacity remains an explicit publish blocker for host review.</p>
    <button type="button" disabled={busy} onClick={() => void generate()} className="mt-3 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Building draft…" : "Build editable draft"}</button>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {result && <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5">
      {result.fallback && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">The AI provider was unavailable, so SealSend created a conservative local draft. Missing facts remain blank.</p>}
      <h3 className="font-bold">{result.draft.event.title}</h3><p className="mt-1 text-sm text-gray-600">{result.draft.event.description}</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Audience</dt><dd>{result.brief.audience}</dd></div><div><dt className="font-semibold">Communication</dt><dd>{result.brief.communicationPreference.replaceAll("_", " ")}</dd></div><div><dt className="font-semibold">Date</dt><dd>{result.draft.event.eventDate || "Needs your input"}</dd></div><div><dt className="font-semibold">Location</dt><dd>{result.draft.event.locationName || "Needs your input"}</dd></div><div><dt className="font-semibold">Capacity</dt><dd>{result.draft.event.maxAttendees || "Needs your input"}</dd></div><div><dt className="font-semibold">RSVP questions</dt><dd>{result.draft.rsvpFields.length}</dd></div></dl>
      {result.draft.missingInformation.length > 0 && <div className="mt-4"><p className="text-sm font-semibold">Missing information</p><ul className="mt-1 list-disc pl-5 text-sm text-amber-800">{result.draft.missingInformation.map((item) => <li key={item}>{item.replace(/^event\./, "").replace(/([A-Z])/g, " $1").toLowerCase()}</li>)}</ul></div>}
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void apply()} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white">Apply to wizard</button><button type="button" disabled={busy} onClick={() => void reject()} className="min-h-11 rounded-xl px-4 text-sm font-medium text-gray-600">Discard</button></div>
    </div>}
  </section>;
}
