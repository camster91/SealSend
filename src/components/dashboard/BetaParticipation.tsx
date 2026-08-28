"use client";

import { useEffect, useState } from "react";
import { BetaOutcomeSurvey } from "@/components/dashboard/BetaOutcomeSurvey";

type Segment = "club_association" | "volunteer_nonprofit" | "creative_community" | "alumni_professional" | "repeat_planner";

interface ParticipationResponse {
  participant: null | {
    label: string;
    segment: Segment;
    consentVersion: string;
    consentedAt: string;
    withdrawnAt: string | null;
    active: boolean;
  };
  progress: null | {
    steps: Record<string, boolean>;
    completedRequired: number;
    requiredTotal: number;
    allRequiredComplete: boolean;
  };
}

const STEPS = [
  ["account", "Account and beta consent"],
  ["eventAndDesign", "Publish an event and review its design"],
  ["guestImport", "Import a guest list"],
  ["controlledInvite", "Send a controlled invitation"],
  ["rsvp", "Receive an RSVP"],
  ["announcementReview", "Approve an announcement"],
  ["calendar", "Download an event calendar file"],
  ["checkIn", "Check in a guest"],
  ["export", "Download the account export"],
  ["feedback", "Submit beta feedback"],
] as const;

export function BetaParticipation() {
  const [data, setData] = useState<ParticipationResponse | null>(null);
  const [inviteToken, setInviteToken] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = async () => {
    const response = await fetch("/api/beta/participation", { cache: "no-store" });
    if (!response.ok) throw new Error("Beta participation could not be loaded.");
    const next = await response.json() as ParticipationResponse;
    setData(next);
  };

  useEffect(() => {
    load().catch((error) => setNotice({ tone: "error", text: error instanceof Error ? error.message : "Beta participation could not be loaded." }));
  }, []);

  const join = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/beta/participation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken: inviteToken.trim(), consent }),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "Beta consent could not be recorded.");
      setData(next);
      setConsent(false);
      setInviteToken("");
      setNotice({ tone: "success", text: "Your controlled-beta consent was recorded." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Beta consent could not be recorded." });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/beta/participation", { method: "DELETE" });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "Beta consent could not be withdrawn.");
      setData(next);
      setNotice({ tone: "success", text: "Your beta observation consent was withdrawn. You can rejoin later." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Beta consent could not be withdrawn." });
    } finally {
      setBusy(false);
    }
  };

  const active = data?.participant?.active === true;

  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50 p-5" aria-labelledby="beta-participation-title">
      <h2 id="beta-participation-title" className="text-lg font-semibold text-gray-900">Controlled beta</h2>
      <p className="mt-2 text-sm text-gray-700">
        SealSend records privacy-limited workflow milestones so the beta can be judged from real use. This evidence does not record guest names, contact details, message bodies, or response content.
      </p>

      {active && data?.participant && data.progress ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-brand-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">Participant {data.participant.label}</p>
            <p className="mt-1 text-sm text-gray-600">
              {data.progress.completedRequired} of {data.progress.requiredTotal} acceptance milestones recorded
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {STEPS.map(([key, label]) => (
              <li key={key} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
                <span aria-hidden="true" className={data.progress?.steps[key] ? "text-green-700" : "text-gray-400"}>
                  {data.progress?.steps[key] ? "✓" : "○"}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
          {data.participant.segment === "repeat_planner" && (
            <p className="text-sm text-gray-700">
              Repeat-event evidence: {data.progress.steps.repeatEvent ? "recorded" : "not yet recorded"}.
            </p>
          )}
          <BetaOutcomeSurvey />
          <button type="button" disabled={busy} onClick={withdraw} className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
            {busy ? "Updating…" : "Withdraw beta consent"}
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {data?.participant?.withdrawnAt && <p className="text-sm text-gray-700">Your previous consent is withdrawn. Rejoining starts a new evidence window.</p>}
          <div>
            <label htmlFor="beta-invitation-code" className="block text-sm font-medium text-gray-900">Invitation code</label>
            <input id="beta-invitation-code" value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} autoComplete="off" spellCheck={false} maxLength={43} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-sm" />
            <p className="mt-1 text-xs text-gray-600">Your operator-issued code assigns the approved cohort segment and can be used once.</p>
          </div>
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
            <span>I consent to SealSend using privacy-limited workflow milestones and my submitted feedback to evaluate this controlled beta. I can withdraw this consent here at any time.</span>
          </label>
          <button type="button" disabled={busy || !consent || inviteToken.trim().length !== 43} onClick={join} className="min-h-11 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? "Joining…" : "Join controlled beta"}
          </button>
        </div>
      )}

      {notice && <p role={notice.tone === "error" ? "alert" : "status"} className={`mt-4 text-sm ${notice.tone === "error" ? "text-red-700" : "text-green-700"}`}>{notice.text}</p>}
    </section>
  );
}
