"use client";

import { useState } from "react";

export function ClientApproval({ token, approvedAt, approverName, accentColor }: {
  token: string;
  approvedAt: string | null;
  approverName: string | null;
  accentColor: string;
}) {
  const [name, setName] = useState("");
  const [state, setState] = useState<{ approvedAt: string | null; approverName: string | null }>({ approvedAt, approverName });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.approvedAt) {
    return (
      <p role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
        Approved by <strong>{state.approverName}</strong> on {new Date(state.approvedAt).toLocaleString()}.
      </p>
    );
  }

  async function approve(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client-shares/${encodeURIComponent(token)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not record your approval.");
        return;
      }
      setState({ approvedAt: new Date().toISOString(), approverName: name.trim() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={approve} className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Your name
        <input
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          required
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="h-11 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: accentColor }}
      >
        {busy ? "Recording…" : "Approve invitation"}
      </button>
    </form>
  );
}
