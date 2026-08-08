"use client";

import { useEffect, useState } from "react";

type Summary = { sourceResponseCount: number; statusCounts: Record<string, number>; attendingHeadcount: number; capacity: null | { maximum: number; remaining: number; utilizationPercent: number }; fields: Array<{ fieldName: string; label: string; answered: number; incomplete: number; counts: Array<{ value: string; count: number }> }> };

export function RsvpIntelligence({ eventId }: { eventId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void fetch(`/api/events/${eventId}/responses/summary`, { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setSummary(data); }).catch(() => setError("The RSVP summary could not be loaded.")); }, [eventId]);
  if (error) return <p role="alert" className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!summary) return <div aria-label="Loading RSVP summary" className="mb-6 h-32 animate-pulse rounded-xl bg-gray-100" />;
  return <section className="mb-6 rounded-xl border bg-white p-5" aria-labelledby="rsvp-intelligence-title">
    <h2 id="rsvp-intelligence-title" className="text-lg font-bold">RSVP intelligence</h2><p className="mt-1 text-sm text-gray-600">Traceable aggregate from {summary.sourceResponseCount} stored response{summary.sourceResponseCount === 1 ? "" : "s"}. Guest comments and free text are never sent to AI.</p>
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><dt className="text-xs text-gray-500">Attending</dt><dd className="text-xl font-bold">{summary.statusCounts.attending ?? 0}</dd></div><div><dt className="text-xs text-gray-500">Headcount</dt><dd className="text-xl font-bold">{summary.attendingHeadcount}</dd></div><div><dt className="text-xs text-gray-500">Maybe</dt><dd className="text-xl font-bold">{summary.statusCounts.maybe ?? 0}</dd></div><div><dt className="text-xs text-gray-500">Declined</dt><dd className="text-xl font-bold">{summary.statusCounts.not_attending ?? 0}</dd></div></dl>
    {summary.capacity && <p className={`mt-4 rounded-lg p-3 text-sm ${summary.capacity.utilizationPercent >= 90 ? "bg-amber-50 text-amber-900" : "bg-gray-50"}`}>Capacity: {summary.attendingHeadcount} of {summary.capacity.maximum} ({summary.capacity.utilizationPercent}%). {summary.capacity.remaining} places remain.</p>}
    {summary.fields.length > 0 && <div className="mt-5 space-y-3">{summary.fields.map((field) => <div key={field.fieldName} className="rounded-lg bg-gray-50 p-3"><p className="font-semibold">{field.label}</p><p className="text-xs text-gray-500">{field.answered} answered · {field.incomplete} incomplete</p>{field.counts.length > 0 && <ul className="mt-2 flex flex-wrap gap-2 text-sm">{field.counts.map((item) => <li key={item.value} className="rounded-full bg-white px-3 py-1">{item.value}: {item.count}</li>)}</ul>}</div>)}</div>}
  </section>;
}
