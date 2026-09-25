"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Share = { id: string; token_preview: string; expires_at: string; approved_at: string | null; approver_name: string | null };
type PanelData = { clientId: string | null; organizationId: string | null; clients: Array<{ id: string; name: string }>; shares: Share[] };

export function EventClientPanel({ eventId }: { eventId: string }) {
  const [data, setData] = useState<PanelData | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/client`);
    setData(res.ok ? await res.json() : null);
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  async function call(input: RequestInfo, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(input, init);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Something went wrong. Please try again.");
        return null;
      }
      return body;
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  return (
    <section aria-labelledby="event-client-heading" className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 id="event-client-heading" className="text-base font-semibold text-gray-900">Client</h2>
      <p className="mt-1 text-sm text-gray-600">Share a read-only review link so your client can see the invitation and response totals, and approve it.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Client for this event"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={data.clientId ?? ""}
          disabled={busy}
          onChange={async (event) => {
            const clientId = event.target.value || null;
            const body = await call(`/api/events/${eventId}/client`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientId }),
            });
            if (body) setData({ ...data, clientId });
          }}
        >
          <option value="">No client</option>
          {data.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <Link href="/settings/clients" className="text-sm font-medium text-brand-700 hover:underline">Manage clients</Link>
      </div>

      <div className="mt-4">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const body = await call(`/api/events/${eventId}/client-shares`, { method: "POST" });
            if (body) {
              setNewLink(body.url);
              await load();
            }
          }}
          className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          Create review link
        </button>
        {newLink && (
          <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm">
            <p className="font-medium text-gray-800">Copy this link now. It won&apos;t be shown again.</p>
            <div className="mt-1 flex gap-2">
              <input readOnly aria-label="Client review link" value={newLink} className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />
              <button type="button" className="rounded border border-gray-300 px-2 text-xs" onClick={() => void navigator.clipboard?.writeText(newLink)}>Copy</button>
            </div>
          </div>
        )}
      </div>

      {data.shares.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
          {data.shares.map((share) => (
            <li key={share.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="text-gray-700">
                Link …{share.token_preview} ·{" "}
                {share.approved_at
                  ? <span className="font-medium text-green-700">Approved by {share.approver_name}</span>
                  : <span>awaiting approval</span>}
                <span className="text-gray-500"> · expires {new Date(share.expires_at).toLocaleDateString()}</span>
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label={`Revoke review link ending ${share.token_preview}`}
                className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                onClick={async () => {
                  if (await call(`/api/events/${eventId}/client-shares/${share.id}`, { method: "DELETE" })) await load();
                }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
