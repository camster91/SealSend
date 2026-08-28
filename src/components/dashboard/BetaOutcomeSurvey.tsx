"use client";

import { useEffect, useState } from "react";
import type { BetaWillingnessToPay } from "@/lib/beta-outcome";

interface Outcome {
  willingnessToPay: BetaWillingnessToPay;
  repeatIntent: number;
  selfReportedSupportMinutes: number;
}

const OPTIONS: Array<{ value: BetaWillingnessToPay; label: string }> = [
  { value: "annual_pro", label: "I would consider SealSend Pro at $124.99/year" },
  { value: "per_event", label: "I would consider a $8.99-$49.99/event plan" },
  { value: "free_only", label: "I would use only a free plan" },
  { value: "unsure", label: "I am not sure yet" },
];

export function BetaOutcomeSurvey() {
  const [willingnessToPay, setWillingnessToPay] = useState<BetaWillingnessToPay | "">("");
  const [repeatIntent, setRepeatIntent] = useState("");
  const [supportMinutes, setSupportMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/beta/outcome", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Beta outcome could not be loaded.");
        return response.json() as Promise<{ outcome: Outcome | null }>;
      })
      .then(({ outcome }) => {
        if (!outcome) return;
        setWillingnessToPay(outcome.willingnessToPay);
        setRepeatIntent(String(outcome.repeatIntent));
        setSupportMinutes(String(outcome.selfReportedSupportMinutes));
      })
      .catch((error) => setNotice({ tone: "error", text: error instanceof Error ? error.message : "Beta outcome could not be loaded." }));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/beta/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ willingnessToPay, repeatIntent: Number(repeatIntent), selfReportedSupportMinutes: Number(supportMinutes) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Beta outcome could not be recorded.");
      setNotice({ tone: "success", text: "Your beta outcome was recorded. You can update it while your consent remains active." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Beta outcome could not be recorded." });
    } finally {
      setBusy(false);
    }
  }

  const complete = willingnessToPay !== "" && /^[1-5]$/.test(repeatIntent)
    && /^\d{1,3}$/.test(supportMinutes) && Number(supportMinutes) <= 600;

  return (
    <form onSubmit={submit} className="rounded-lg border border-brand-200 bg-white p-4" aria-labelledby="beta-outcome-title">
      <h3 id="beta-outcome-title" className="font-semibold text-gray-900">Beta outcome check-in</h3>
      <p className="mt-1 text-sm text-gray-600">These answers record stated intent, not paid conversion. Support time is self-reported, not operator-observed.</p>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-gray-900">Which option best matches your willingness to pay today?</legend>
        <div className="mt-2 space-y-2">
          {OPTIONS.map((option) => (
            <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm text-gray-700">
              <input type="radio" name="willingness-to-pay" value={option.value} checked={willingnessToPay === option.value} onChange={() => setWillingnessToPay(option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4">
        <label htmlFor="beta-repeat-intent" className="block text-sm font-medium text-gray-900">How likely are you to use SealSend for another event? (1-5)</label>
        <select id="beta-repeat-intent" value={repeatIntent} onChange={(event) => setRepeatIntent(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3">
          <option value="">Choose a rating</option>
          {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <div className="mt-4">
        <label htmlFor="beta-support-minutes" className="block text-sm font-medium text-gray-900">Self-reported minutes of direct SealSend help used</label>
        <input id="beta-support-minutes" type="number" inputMode="numeric" min={0} max={600} step={1} required value={supportMinutes} onChange={(event) => setSupportMinutes(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border px-3" />
        <p className="mt-1 text-xs text-gray-600">Enter 0 if you completed the workflow without direct help.</p>
      </div>
      <button disabled={busy || !complete} className="mt-4 min-h-11 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Recording…" : "Record beta outcome"}
      </button>
      {notice && <p role={notice.tone === "error" ? "alert" : "status"} className={`mt-3 text-sm ${notice.tone === "error" ? "text-red-700" : "text-green-700"}`}>{notice.text}</p>}
    </form>
  );
}
