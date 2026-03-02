'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, Loader2 } from 'lucide-react';

interface AutoRemindersToggleProps {
  eventId: string;
  initialEnabled: boolean;
  eventDate: string | null;
  isPublished: boolean;
}

export function AutoRemindersToggle({ 
  eventId, 
  initialEnabled, 
  eventDate,
  isPublished 
}: AutoRemindersToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const router = useRouter();

  // Don't show if event has no date or is not published
  if (!eventDate || !isPublished) {
    return null;
  }

  const handleToggle = async () => {
    setIsLoading(true);
    setShowSuccess(false);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_reminders: !enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update setting');
      }

      setEnabled(!enabled);
      setShowSuccess(true);
      
      // Hide success message after 2 seconds
      setTimeout(() => setShowSuccess(false), 2000);
      
      // Refresh the page data
      router.refresh();
    } catch (error) {
      console.error('Error updating auto reminders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const eventDateObj = new Date(eventDate);
  const now = new Date();
  const hoursUntilEvent = (eventDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  // Show warning if event is less than 48 hours away
  const showWarning = hoursUntilEvent < 48 && hoursUntilEvent > 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <Bell className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Automatic Reminders</h3>
            {showSuccess && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Automatically send reminder emails and SMS to guests 24-48 hours before the event.
          </p>
          
          {showWarning && (
            <p className="mt-2 text-xs text-amber-600">
              ⚠️ Event is less than 48 hours away. Reminders may be sent immediately.
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleToggle}
              disabled={isLoading}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                ${enabled ? 'bg-brand-600' : 'bg-gray-200'}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              role="switch"
              aria-checked={enabled}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${enabled ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
              {isLoading && (
                <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-gray-400" />
              )}
            </button>
            <span className="text-sm font-medium text-gray-700">
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
