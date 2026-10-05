'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type PublishBlocker = { field: string; message: string };

export function PublishEventButton({ eventId, isPublished }: { eventId: string; isPublished: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<PublishBlocker[]>([]);

  async function togglePublication() {
    setBusy(true);
    setError(null);
    setBlockers([]);
    try {
      const response = await fetch(`/api/events/${eventId}/publish`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || `The event could not be ${isPublished ? 'unpublished' : 'published'}.`);
        setBlockers(Array.isArray(data.blockers) ? data.blockers : []);
        return;
      }
      router.refresh();
    } catch {
      setError('The publication request could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void togglePublication()}
        disabled={busy}
        aria-busy={busy}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
          isPublished
            ? 'border border-input bg-white text-ink hover:bg-neutral-50'
            : 'bg-wax text-white hover:bg-wax-dark'
        }`}
      >
        {busy ? 'Updating…' : isPublished ? 'Unpublish' : 'Publish event'}
      </button>

      {error && (
        <div role="alert" className="rounded-2xl border border-warning-500/50 bg-warning-50 p-4 text-sm text-neutral-800">
          <p className="font-semibold">{error}</p>
          {blockers.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {blockers.map((blocker) => <li key={blocker.field}>{blocker.message}</li>)}
            </ul>
          )}
          {!isPublished && (
            <Link href={`/events/${eventId}/edit`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4">
              Review event details
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
