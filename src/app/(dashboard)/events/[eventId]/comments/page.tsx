"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { useToast } from "@/components/ui/Toast";
import { formatRelative } from "@/lib/utils";
import type { EventComment } from "@/types/database";

export default function CommentsPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [comments, setComments] = useState<EventComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EventComment | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(Array.isArray(data) ? data : []);
      } else {
        setLoadError("Could not load comments. Please try again.");
      }
    } catch {
      setLoadError("Network error while loading comments.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    const comment = pendingDelete;
    setBusy(true);
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId: comment.id }),
      });
      if (!res.ok) {
        setComments((prev) =>
          [...prev, comment].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        );
        toastRef.current.error("Failed to delete comment.");
        return;
      }
      toastRef.current.success("Comment deleted");
    } catch {
      setComments((prev) => [...prev, comment]);
      toastRef.current.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/events/${eventId}`}
          className="mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to event
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Comments</h1>
        <p className="text-sm text-muted-foreground">
          {comments.length} comment{comments.length !== 1 ? "s" : ""}
        </p>
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

      {loading ? (
        <CardListSkeleton rows={3} />
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments yet"
          description="When guests leave notes on your invite, they’ll appear here."
        />
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="animate-fade-in rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-900">{comment.author_name}</p>
                    {comment.is_private && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatRelative(comment.created_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(comment)}
                  className="text-neutral-500 hover:text-error-600"
                  aria-label="Delete comment"
                  tooltip="Delete comment"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{comment.message}</p>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete comment?"
        description="This permanently removes the comment. This cannot be undone."
        confirmLabel="Delete"
        loading={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
