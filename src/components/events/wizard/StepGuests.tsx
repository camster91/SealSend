'use client';

import { useState } from 'react';
import { parseGuestCsv, type GuestCsvIssue } from '@/lib/guest-import';

interface GuestEntry {
  name: string;
  email: string;
}

interface StepGuestsProps {
  guests: GuestEntry[];
  onUpdate: (guests: GuestEntry[]) => void;
}

export default function StepGuests({ guests, onUpdate }: StepGuestsProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [csvText, setCsvText] = useState('');
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; issues: GuestCsvIssue[] } | null>(null);

  const handleAdd = () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email');
      return;
    }
    if (normalizedEmail && guests.some((guest) => guest.email.trim().toLowerCase() === normalizedEmail)) {
      setError('This email is already on the guest list');
      return;
    }
    setError('');
    onUpdate([...guests, { name: name.trim(), email: normalizedEmail }]);
    setName('');
    setEmail('');
  };

  const handleRemove = (index: number) => {
    onUpdate(guests.filter((_, i) => i !== index));
  };

  const handleCsvImport = () => {
    if (!csvText.trim()) return;
    const result = parseGuestCsv(csvText, guests);
    if (result.guests.length > 0) onUpdate([...guests, ...result.guests]);
    if (result.issues.length === 0) setCsvText('');
    setImportResult({ imported: result.guests.length, issues: result.issues });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Add Your Guests</h2>
        <p className="mt-2 text-base text-gray-500">
          Add guests now or skip this step — you can always manage your guest list later.
        </p>
      </div>

      {/* Quick-add form */}
      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-ink" aria-hidden="true">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-ink">Add Guest</h3>
          {guests.length > 0 && (
            <span className="ml-auto rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-ink">
              {guests.length} guest{guests.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <input
                type="text"
                aria-label="Guest name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Guest name *"
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-input bg-white px-4 text-sm text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-ink focus:ring-offset-2 placeholder:text-neutral-500"
              />
            </div>
            <div className="flex-1">
              <input
                type="email"
                aria-label="Guest email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Email (optional)"
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-input bg-white px-4 text-sm text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-ink focus:ring-offset-2 placeholder:text-neutral-500"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              Add
            </button>
          </div>
          {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}

          {/* CSV Import toggle */}
          <button
            type="button"
            onClick={() => setShowCsvImport(!showCsvImport)}
            aria-expanded={showCsvImport}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            {showCsvImport ? 'Hide CSV Import' : 'Import from CSV'}
          </button>

          {showCsvImport && (
            <div className="space-y-3 rounded-xl border border-border bg-neutral-50 p-4">
              <p className="text-xs text-neutral-600">Paste CSV data: one guest per line, format: <code className="rounded bg-neutral-200 px-1">Name, Email</code></p>
              <textarea
                aria-label="Guest CSV data"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={4}
                placeholder={"John Doe, john@example.com\nJane Smith, jane@example.com\nBob (no email)"}
                className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink focus:ring-offset-2 placeholder:text-neutral-500"
              />
              <button
                type="button"
                onClick={handleCsvImport}
                className="min-h-10 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 any-pointer-coarse:min-h-11"
              >
                Import Guests
              </button>
              {importResult && (
                <div role="status" className={`text-xs ${importResult.issues.length > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  <p>
                    {importResult.imported > 0
                      ? `${importResult.imported} guest${importResult.imported === 1 ? '' : 's'} added to this draft.`
                      : 'No guests were added.'}
                    {importResult.issues.length > 0 && ` ${importResult.issues.length} row${importResult.issues.length === 1 ? '' : 's'} need attention.`}
                  </p>
                  {importResult.issues.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {importResult.issues.map((issue) => (
                        <li key={`${issue.row}-${issue.message}`}>Row {issue.row}: {issue.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Guest list */}
      {guests.length > 0 ? (
        <div className="rounded-2xl border border-border bg-white overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-ink">Guest List</h3>
            <span className="ml-auto text-xs text-neutral-600">{guests.length} total</span>
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {guests.map((guest, index) => (
              <div key={index} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-ink" aria-hidden="true">
                    {guest.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{guest.name}</p>
                    {guest.email && <p className="text-xs text-neutral-600">{guest.email}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  aria-label={`Remove ${guest.name}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-error-50 hover:text-error-700 any-pointer-coarse:h-11 any-pointer-coarse:w-11"
                >
                  <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <p className="mt-3 text-sm font-medium text-gray-500">No guests added yet</p>
          <p className="mt-1 text-xs text-gray-400">Add guests above or import a CSV file</p>
        </div>
      )}

      <p className="text-center text-sm text-gray-400">
        You can add more guests later from the guest management page.
      </p>
    </div>
  );
}
