'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X, CheckCircle2 } from 'lucide-react';

interface SendAnnouncementModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  onSuccess: () => void;
}

export function SendAnnouncementModal({ open, onClose, eventId, onSuccess }: SendAnnouncementModalProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent_to_count: number } | null>(null);

  function reset() {
    setSubject('');
    setMessage('');
    setSending(false);
    setError(null);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send announcement');
      }

      const data = await res.json();
      setResult({ sent_to_count: data.sent_to_count });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send announcement');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Send Announcement</h2>
          <button aria-label="Close announcement modal" onClick={handleClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {result ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-lg font-semibold text-gray-900">Announcement Sent!</p>
              <p className="text-sm text-muted-foreground">
                Emailed to {result.sent_to_count} guest{result.sent_to_count !== 1 ? 's' : ''}
              </p>
              <Button onClick={handleClose}>Done</Button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <p className="text-sm text-gray-600">
                This will email all guests who have an email address on file.
              </p>
              <div>
                <label htmlFor="ann-subject" className="block text-sm font-medium text-gray-700">Subject</label>
                <input
                  id="ann-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Venue Change"
                  maxLength={200}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label htmlFor="ann-message" className="block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  id="ann-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your announcement..."
                  maxLength={5000}
                  required
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={handleClose}>Cancel</Button>
                <Button type="submit" loading={sending}>
                  Send Announcement
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
