"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { useToast } from "@/components/ui/Toast";
import type { SignupItemWithClaims } from "@/types/database";

export default function SignupsPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [items, setItems] = useState<SignupItemWithClaims[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [slots, setSlots] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SignupItemWithClaims | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/signups`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } else {
        setLoadError("Could not load sign-up items.");
      }
    } catch {
      setLoadError("Network error while loading sign-ups.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/signups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          slots: parseInt(slots, 10) || 1,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || "Could not add item. Please try again.");
        return;
      }

      setTitle("");
      setDescription("");
      setCategory("");
      setSlots("1");
      setShowForm(false);
      toastRef.current.success("Sign-up item added");
      fetchItems();
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setBusy(true);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/events/${eventId}/signups`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (!res.ok) {
        setItems((prev) => [...prev, item]);
        toastRef.current.error("Failed to delete item.");
        return;
      }
      toastRef.current.success("Item deleted");
    } catch {
      setItems((prev) => [...prev, item]);
      toastRef.current.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const totalItems = items.length;
  const totalClaims = items.reduce((sum, i) => sum + (i.claims?.length ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/events/${eventId}`}
            className="mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to event
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Sign-Up Board</h1>
          <p className="text-sm text-muted-foreground">
            {totalItems} item{totalItems !== 1 ? "s" : ""} · {totalClaims} claim
            {totalClaims !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>
          <Plus className="mr-1 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {loadError && (
        <InlineBanner
          variant="error"
          title="Something went wrong"
          onDismiss={() => setLoadError(null)}
          className="mb-4"
        >
          {loadError}
        </InlineBanner>
      )}

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mb-6 space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          {formError && (
            <InlineBanner variant="error" onDismiss={() => setFormError(null)}>
              {formError}
            </InlineBanner>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="signup-title" className="block text-sm font-medium text-neutral-800">
                Title *
              </label>
              <input
                id="signup-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Chips & Salsa, Set up chairs"
                required
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label htmlFor="signup-category" className="block text-sm font-medium text-neutral-800">
                Category
              </label>
              <input
                id="signup-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Food, Drinks, Setup, Tasks"
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="signup-description"
                className="block text-sm font-medium text-neutral-800"
              >
                Description
              </label>
              <input
                id="signup-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details"
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label htmlFor="signup-slots" className="block text-sm font-medium text-neutral-800">
                Slots needed
              </label>
              <input
                id="signup-slots"
                type="number"
                min="1"
                max="100"
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={submitting}>
              Add Item
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <CardListSkeleton rows={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No sign-up items yet"
          description="Add items for guests to claim — potluck dishes, volunteer roles, or anything you need covered."
          actionLabel="Add Item"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const claimed = item.claims?.length ?? 0;
            const isFull = claimed >= item.slots;

            return (
              <div
                key={item.id}
                className={`animate-fade-in rounded-2xl border bg-white p-4 shadow-sm ${
                  isFull ? "border-success-100" : "border-neutral-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                      {item.category && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                          {item.category}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isFull
                            ? "bg-success-100 text-success-700"
                            : "bg-warning-100 text-warning-600"
                        }`}
                      >
                        {claimed}/{item.slots} claimed
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-neutral-600">{item.description}</p>
                    )}
                    {item.claims && item.claims.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.claims.map((claim) => (
                          <span
                            key={claim.id}
                            className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-medium text-success-700"
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
                    onClick={() => setPendingDelete(item)}
                    className="text-neutral-500 hover:text-error-600"
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

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete sign-up item?"
        description="This removes the item and all its claims. This cannot be undone."
        confirmLabel="Delete"
        loading={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
