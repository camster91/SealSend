"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptWorkspaceInvite({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");

  async function accept() {
    setStatus("busy");
    const response = await fetch(`/api/workspace-invites/${encodeURIComponent(token)}/accept`, { method: "POST" });
    if (response.status === 401) {
      router.push(`/login?redirect=${encodeURIComponent(`/team/workspace/${token}`)}`);
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(data.error ?? "Could not accept this invitation.");
      return;
    }
    router.push("/settings/team");
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900">Join a workspace</h1>
      <p className="mt-2 text-sm text-gray-600">Sign in with the invited email address, then accept to see the workspace&apos;s events.</p>
      {message && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={accept} disabled={status === "busy"} className="h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-50">
          {status === "busy" ? "Accepting…" : "Accept invitation"}
        </button>
        <Link href="/dashboard" className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium text-gray-600">Cancel</Link>
      </div>
    </div>
  );
}
