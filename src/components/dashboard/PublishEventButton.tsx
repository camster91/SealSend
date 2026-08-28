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
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${
          isPublished
            ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20 hover:shadow-lg'
        }`}
      >
        {busy ? 'Updating…' : isPublished ? 'Unpublish' : 'Publish Event'}
      </button>

      {error && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">{error}</p>
          {blockers.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {blockers.map((blocker) => <li key={blocker.field}>{blocker.message}</li>)}
            </ul>
          )}
          {!isPublished && (
            <Link href={`/events/${eventId}/edit`} className="mt-3 inline-flex font-semibold text-brand-700 underline underline-offset-2">
              Review event details
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
