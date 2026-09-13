"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Waitlist capture shown when annual Pro checkout is not yet available.
 *
 * Issue #149: production previously rendered a disabled button reading
 * "Test billing setup pending" — internal wording and a dead end for
 * prospective customers. This component replaces that with a truthful,
 * working path that captures interest while checkout stays fail-closed.
 */
export function ProWaitlistForm({ planId = "pro_annual" }: { planId?: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function joinWaitlist(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan: planId, source: "pricing" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not join the waitlist");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the waitlist");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
      >
        <p className="flex items-center gap-2 font-medium">
          <Check className="h-4 w-4" /> You&apos;re on the list
        </p>
        <p className="mt-1 text-green-700">
          We&apos;ll email you as soon as annual Pro is available.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={joinWaitlist} className="space-y-2">
      <Input
        id={`waitlist-${planId}`}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email address for the annual Pro waitlist"
        error={error ?? undefined}
      />
      <Button type="submit" loading={loading} className="w-full">
        {loading ? "Joining…" : "Notify me when it's ready"}
        {!loading && <ArrowRight className="ml-1 h-4 w-4" />}
      </Button>
      <p className="text-center text-xs text-neutral-500">
        Annual Pro is not open yet. Join the list and we&apos;ll let you know.
      </p>
    </form>
  );
}
