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
    const res = await fetch(`/api/events/${eventId}/announcements`);
    if (res.ok) {
      const data = await res.json();
      setAnnouncements(data);
    }
    setLoading(false);
  }, [eventId]);

  async function cancel(announcementId: string) {
    const response = await fetch(`/api/events/${eventId}/announcements/${announcementId}`, { method: 'DELETE' });
    if (!response.ok) { setError('The announcement could not be cancelled. It may already be dispatching.'); return; }
    setError('');
    await fetchAnnouncements();
  }

  async function retry(announcementId: string) {
    const response = await fetch(`/api/events/${eventId}/announcements/${announcementId}/retry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: true }) });
    if (!response.ok) { setError('Failed deliveries could not be retried.'); return; }
    setError('');
    await fetchAnnouncements();
  }

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements, refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (announcements.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Announcement History
        </h2>
      </div>
      <div className="divide-y divide-gray-100">
        {error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {announcements.map((ann) => (
          <div key={ann.id} className="px-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{ann.subject}</p>
              <span className="text-xs text-muted-foreground">{formatRelative(ann.created_at)}</span>
            </div>
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{ann.message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-full bg-gray-100 px-2 py-1 font-medium capitalize">{ann.status.replace('_', ' ')}</span>
              <span>{ann.status === 'queued' ? `Scheduled ${formatRelative(ann.scheduled_at)}` : `${ann.accepted_count ?? ann.sent_to_count} accepted · ${ann.failed_count ?? 0} failed`}</span>
              {ann.status === 'queued' && <button onClick={() => void cancel(ann.id)} className="min-h-10 rounded-lg px-3 font-medium text-red-600 hover:bg-red-50">Cancel</button>}
              {(ann.status === 'failed' || ann.status === 'partially_failed') && <button onClick={() => void retry(ann.id)} className="min-h-10 rounded-lg px-3 font-medium text-brand-700 hover:bg-brand-50">Retry failed only</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
