'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CloneEventButtonProps {
  eventId: string;
  eventTitle: string;
  variant?: 'button' | 'menu-item';
}

export function CloneEventButton({ eventId, eventTitle, variant = 'button' }: CloneEventButtonProps) {
  const router = useRouter();
  const [isCloning, setIsCloning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleClone = async () => {
    setIsCloning(true);
    try {
      const res = await fetch(`/api/events/${eventId}/clone`, { method: 'POST' });
      const data = await res.json();
      
      if (res.ok && data.event) {
        setShowSuccess(true);
        // Show success message briefly before redirecting
        setTimeout(() => {
          router.push(`/events/${data.event.id}`);
          router.refresh();
        }, 1500);
      } else {
        setIsCloning(false);
        alert(data.error || 'Failed to clone event');
      }
    } catch (error) {
      setIsCloning(false);
      alert('An error occurred while cloning the event');
    }
  };

  // Success toast overlay
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mt-4 text-center text-lg font-semibold text-gray-900">Event Cloned!</h3>
          <p className="mt-2 text-center text-sm text-gray-500">
            <strong>&ldquo;{eventTitle} (Copy)&rdquo;</strong> has been created successfully.
          </p>
          <p className="mt-4 text-center text-xs text-gray-400">Redirecting to new event...</p>
        </div>
      </div>
    );
  }

  // Menu item variant (for dropdown menus)
  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        onClick={handleClone}
        disabled={isCloning}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        {isCloning ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Cloning...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Clone Event
          </>
        )}
      </button>
    );
  }

  // Button variant (default)
  return (
    <button
      type="button"
      onClick={handleClone}
      disabled={isCloning}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 disabled:opacity-50"
    >
      {isCloning ? (
        <>
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Cloning...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Clone
        </>
      )}
    </button>
  );
}
