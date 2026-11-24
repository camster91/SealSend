"use client";

import { useCallback, useEffect, useState } from "react";
import type { UnmatchedReply } from "@/lib/rsvp-match";
import { replyGroup } from "@/lib/reply-groups";

const REPLY_LABEL = { yes: "is coming", no: "can't come", maybe: "might come", waiting: "replied" } as const;
const BUTTON = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-50";

export function UnmatchedReplies({ eventId, onChange }: { eventId: string; onChange: () => void }) {
  const [replies, setReplies] = useState<UnmatchedReply[]>([]);
  const [notSuggested, setNotSuggested] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/responses/unmatched`, { cache: "no-store" });
      if (!response.ok) throw new Error("load");
      setReplies(await response.json());
    } catch {
      setError("We couldn't load replies from your shared link. Refresh to try again.");
    }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function save(reply: UnmatchedReply, body: object) {
    setBusy(reply.id);
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/responses/${reply.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error || "That didn't save. Please try again.");
        return;
      }
      await load();
      onChange();
    } catch {
      setError("That didn't save. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (replies.length === 0 && !error) return null;
  return (
    <section aria-labelledby="unmatched-title" className="mb-6 rounded-2xl border border-border bg-white p-5">
      <h2 id="unmatched-title" className="text-lg font-semibold text-ink">Replies from your shared link</h2>
      <p className="mt-1 text-sm text-neutral-700">Confirm who these are, so your list and updates include them.</p>
      {error && <p role="alert" className="mt-3 text-sm text-accent-red">{error}</p>}
      <ul className="mt-3 divide-y divide-border">
        {replies.map((reply) => {
          const suggested = reply.suggested_guest_id && !notSuggested.includes(reply.id) ? reply.suggested_guest_name : null;
          return (
            <li key={reply.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-words text-sm text-ink">
                  <strong>{reply.respondent_name}</strong> {REPLY_LABEL[replyGroup(reply.status)]}{reply.headcount > 1 ? ` (${reply.headcount} people)` : ""}
                </p>
                {reply.respondent_email && <p className="break-all text-sm text-neutral-600">{reply.respondent_email}</p>}
              </div>
              {suggested ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink">Is this {suggested} on your list?</span>
                  <button type="button" disabled={busy !== null} onClick={() => void save(reply, { guestId: reply.suggested_guest_id })} className={`${BUTTON} bg-ink text-white`}>Yes, confirm</button>
                  <button type="button" disabled={busy !== null} onClick={() => setNotSuggested((ids) => [...ids, reply.id])} className={`${BUTTON} border border-input bg-white text-ink`}>No</button>
                </div>
              ) : (
                <button type="button" disabled={busy !== null} onClick={() => void save(reply, { addGuest: true })} aria-label={`Add to guest list: ${reply.respondent_name}`} className={`${BUTTON} border border-input bg-white text-ink`}>Add to guest list</button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
