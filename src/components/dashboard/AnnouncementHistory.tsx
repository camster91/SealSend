'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatRelative } from '@/lib/utils';
import type { EventAnnouncement } from '@/types/database';

interface AnnouncementHistoryProps {
  eventId: string;
  refreshKey: number;
}

export function AnnouncementHistory({ eventId, refreshKey }: AnnouncementHistoryProps) {
  const [announcements, setAnnouncements] = useState<EventAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventId}/announcements`);
      if (!res.ok) throw new Error('announcement history request failed');
      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error('announcement history response was invalid');
      setAnnouncements(data as EventAnnouncement[]);
    } catch {
      setError('Announcement history could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  async function cancel(announcementId: string) {
    try {
      const response = await fetch(`/api/events/${eventId}/announcements/${announcementId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('cancel failed');
      await fetchAnnouncements();
    } catch {
      setError('The announcement could not be cancelled. It may already be dispatching.');
    }
  }

  async function retry(announcementId: string) {
    try {
      const response = await fetch(`/api/events/${eventId}/announcements/${announcementId}/retry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: true }) });
      if (!response.ok) throw new Error('retry failed');
      await fetchAnnouncements();
    } catch {
      setError('Failed deliveries could not be retried.');
    }
  }

  useEffect(() => {
    void fetchAnnouncements();
  }, [fetchAnnouncements, refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent" role="status" aria-label="Loading announcements" />
      </div>
    );
  }

  if (announcements.length === 0) {
    if (!error) return null;
    return (
      <div role="alert" className="mt-6 rounded-2xl border border-error-100 bg-error-50 p-4 text-sm text-error-700">
        <p>{error}</p>
        <button type="button" onClick={() => void fetchAnnouncements()} className="mt-3 min-h-10 rounded-lg border border-error-200 bg-white px-3 font-medium text-error-800 hover:bg-error-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-white">
      <div className="border-b border-border px-6 py-3.5">
        <h2 className="text-sm font-semibold text-ink">
          Announcement history
        </h2>
      </div>
      <div className="divide-y divide-border">
        {error && (
          <div role="alert" className="m-4 rounded-lg border border-error-100 bg-error-50 p-3 text-sm text-error-700">
            <p>{error}</p>
            <button type="button" onClick={() => void fetchAnnouncements()} className="mt-2 min-h-10 rounded-lg px-3 font-medium hover:bg-error-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
              Try again
            </button>
          </div>
        )}
        {announcements.map((ann) => (
          <div key={ann.id} className="px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{ann.subject}</p>
              <span className="shrink-0 text-xs text-neutral-600">{formatRelative(ann.created_at)}</span>
            </div>
            <p className="mt-1 text-sm text-neutral-700 line-clamp-2">{ann.message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
              <span className="rounded-full bg-neutral-100 px-2 py-1 font-medium capitalize text-neutral-700">{ann.status.replace('_', ' ')}</span>
              <span>{ann.status === 'queued' ? `Scheduled ${formatRelative(ann.scheduled_at)}` : `${ann.accepted_count ?? ann.sent_to_count} accepted · ${ann.failed_count ?? 0} failed`}</span>
              {ann.status === 'queued' && <button type="button" onClick={() => void cancel(ann.id)} className="min-h-10 rounded-lg px-3 font-medium text-error-700 hover:bg-error-50 any-pointer-coarse:min-h-11">Cancel</button>}
              {(ann.status === 'failed' || ann.status === 'partially_failed') && <button type="button" onClick={() => void retry(ann.id)} className="min-h-10 rounded-lg px-3 font-medium text-ink hover:bg-neutral-100 any-pointer-coarse:min-h-11">Retry failed only</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
