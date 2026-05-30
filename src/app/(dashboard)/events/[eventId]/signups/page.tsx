'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { SignupItemWithClaims } from '@/types/database';

export default function SignupsPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [items, setItems] = useState<SignupItemWithClaims[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [slots, setSlots] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/signups`);
    if (res.ok) {
      const data = await res.json();
      setItems(data);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    const res = await fetch(`/api/events/${eventId}/signups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        slots: parseInt(slots, 10) || 1,
      }),
    });

    if (res.ok) {
      setTitle('');
      setDescription('');
      setCategory('');
      setSlots('1');
      setShowForm(false);
      fetchItems();
    }
    setSubmitting(false);
  }

  async function handleDelete(itemId: string) {
    if (!confirm('Delete this item and all its claims?')) return;

    const res = await fetch(`/api/events/${eventId}/signups`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    });

    if (res.ok) fetchItems();
  }

  const totalItems = items.length;
  const totalClaims = items.reduce((sum, i) => sum + (i.claims?.length ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href={`/events/${eventId}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to event
          </Link>
          <h1 className="text-2xl font-bold">Sign-Up Board</h1>
          <p className="text-sm text-muted-foreground">
            {totalItems} item{totalItems !== 1 ? 's' : ''} &middot; {totalClaims} claim{totalClaims !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Chips & Salsa, Set up chairs"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Food, Drinks, Setup, Tasks"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slots needed</label>
              <input
                type="number"
                min="1"
                max="100"
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={submitting}>Add Item</Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-muted-foreground">No sign-up items yet. Add items for guests to claim.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const claimed = item.claims?.length ?? 0;
            const isFull = claimed >= item.slots;

            return (
              <div
                key={item.id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  isFull ? 'border-green-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      {item.category && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          {item.category}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isFull ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {claimed}/{item.slots} claimed
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
                    )}
                    {item.claims && item.claims.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.claims.map((claim) => (
                          <span
                            key={claim.id}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                          >
                            {claim.claimant_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item.id)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label="Delete item"
                    tooltip="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
