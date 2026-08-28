'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zonedLocalDateTimeToInstant } from '@/lib/datetime';

interface CloneEventButtonProps {
  eventId: string;
  eventTitle: string;
  eventTimezone?: string;
  variant?: 'button' | 'menu-item';
}

export function CloneEventButton({
  eventId,
  eventTitle,
  eventTimezone = 'UTC',
  variant = 'button',
}: CloneEventButtonProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [title, setTitle] = useState(`${eventTitle} - next event`);
  const [eventDate, setEventDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [rsvpDeadline, setRsvpDeadline] = useState('');
  const [includeGuests, setIncludeGuests] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    titleInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCloning) {
        setIsOpen(false);
        setCloneError(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCloning, isOpen]);

  const closeModal = () => {
    if (isCloning) return;
    setIsOpen(false);
    setCloneError(null);
    triggerRef.current?.focus();
  };

  const handleClone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCloneError(null);
    setIsCloning(true);
    try {
      const body = {
        title,
        eventDate: zonedLocalDateTimeToInstant(eventDate, eventTimezone),
        eventEndDate: eventEndDate ? zonedLocalDateTimeToInstant(eventEndDate, eventTimezone) : null,
        rsvpDeadline: rsvpDeadline ? zonedLocalDateTimeToInstant(rsvpDeadline, eventTimezone) : null,
        includeGuests,
      };
      const res = await fetch(`/api/events/${eventId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.event) {
        setCloneError(data.error || 'Failed to repeat event');
        return;
      }

      setIsOpen(false);
      setShowSuccess(true);
      setTimeout(() => {
        router.push(`/events/${data.event.id}/edit`);
        router.refresh();
      }, 900);
    } catch (error) {
      setCloneError(error instanceof Error ? error.message : 'An error occurred while repeating the event');
    } finally {
      setIsCloning(false);
    }
  };

  const triggerClass = variant === 'menu-item'
    ? 'flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900';

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="status">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700" aria-hidden="true">✓</div>
          <h3 className="mt-4 text-center text-lg font-semibold text-gray-900">Next event draft created</h3>
          <p className="mt-2 text-center text-sm text-gray-600">Redirecting to <strong>{title}</strong> for review.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setIsOpen(true)} className={triggerClass} aria-haspopup="dialog">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Repeat event
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby={`repeat-event-title-${eventId}`}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={`repeat-event-title-${eventId}`} className="text-xl font-semibold text-gray-900">Repeat event</h2>
                <p className="mt-1 text-sm text-gray-600">Create a fresh draft from this event&apos;s setup.</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Close repeat event dialog">×</button>
            </div>

            <form onSubmit={handleClone} className="mt-6 space-y-5">
              <label className="block text-sm font-medium text-gray-800">
                New event title
                <input ref={titleInputRef} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-gray-800">
                New start date and time
                <input type="datetime-local" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-gray-800">
                New end date and time <span className="font-normal text-gray-500">(optional)</span>
                <input type="datetime-local" value={eventEndDate} onChange={(event) => setEventEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-gray-800">
                New RSVP deadline <span className="font-normal text-gray-500">(optional)</span>
                <input type="datetime-local" value={rsvpDeadline} onChange={(event) => setRsvpDeadline(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <p className="-mt-3 text-xs text-gray-500">Times use {eventTimezone}.</p>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input type="checkbox" checked={includeGuests} onChange={(event) => setIncludeGuests(event.target.checked)} className="mt-1 h-4 w-4" />
                <span>
                  <span className="block text-sm font-medium text-gray-800">Copy reusable guest contacts and tags</span>
                  <span className="block text-xs text-gray-500">Optional because this copies names, emails, and phone numbers into the new draft.</span>
                </span>
              </label>

              <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
                SealSend copies the invitation design, RSVP questions, sign-up board structure, and intended audience. The audience carries forward, but accessibility and communication decisions must be reviewed again. It does not copy responses, check-ins, messages, or guest notes.
              </div>

              {cloneError && <p role="alert" className="text-sm text-red-700">{cloneError}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeModal} disabled={isCloning} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isCloning} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {isCloning ? 'Creating draft...' : 'Create next event draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
