'use client';

import { useState, useEffect, useCallback } from 'react';
import { getClientUser } from '@/lib/auth/client-auth';
import type { SignupItemWithClaims } from '@/types/database';

interface SignupBoardProps {
  eventSlug: string;
}

export function SignupBoard({ eventSlug }: SignupBoardProps) {
  const [items, setItems] = useState<SignupItemWithClaims[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimName, setClaimName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/signups/${eventSlug}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      // Offline / network — keep empty list
    } finally {
      setLoading(false);
    }
  }, [eventSlug]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Auto-fill name from session cookie (runs once on mount)
  useEffect(() => {
    const user = getClientUser();
    if (user) {
      const name = user.name || user.email?.split('@')[0] || '';
      if (name) setClaimName((prev) => prev || name);
    }
  }, []);

  async function handleClaim(itemId: string) {
    if (!claimName.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/signups/${eventSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          claimant_name: claimName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign up');
      }

      setClaimingId(null);
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-7 w-7 animate-spin rounded-full border-3 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (items.length === 0) return null;

  // Group items by category
  const categories = new Map<string, SignupItemWithClaims[]>();
  items.forEach((item) => {
    const cat = item.category || 'Items';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(item);
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50/60 to-teal-50/30 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Sign-Up Board</h2>
          <p className="text-xs text-gray-500">Claim items to bring or tasks to help with</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {Array.from(categories.entries()).map(([category, catItems]) => (
          <div key={category}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{category}</h3>
            <div className="space-y-2">
              {catItems.map((item) => {
                const claimed = item.claims?.length ?? 0;
                const isFull = claimed >= item.slots;
                const isClaimingThis = claimingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isFull ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${isFull ? 'text-green-700' : 'text-gray-900'}`}>
                            {item.title}
                          </p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isFull
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {claimed}/{item.slots}
                          </span>
                        </div>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
                        )}
                        {/* Show who claimed */}
                        {item.claims && item.claims.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.claims.map((claim) => (
                              <span
                                key={claim.id}
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                              >
                                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                {claim.claimant_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {!isFull && !isClaimingThis && (
                        <button
                          type="button"
                          onClick={() => setClaimingId(item.id)}
                          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 active:scale-95"
                        >
                          Sign Up
                        </button>
                      )}
                    </div>

                    {/* Inline claim form */}
                    {isClaimingThis && (
                      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                        <input
                          type="text"
                          value={claimName}
                          onChange={(e) => setClaimName(e.target.value)}
                          placeholder="Your name"
                          autoComplete="name"
                          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleClaim(item.id)}
                          disabled={submitting || !claimName.trim()}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {submitting ? 'Claiming...' : 'Claim'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setClaimingId(null); setError(null); }}
                          className="rounded-lg px-2 py-2 text-sm text-gray-400 hover:text-gray-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
