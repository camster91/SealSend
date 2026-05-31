'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatRelative } from '@/lib/utils';
import type { EventComment } from '@/types/database';

export default function CommentsPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [comments, setComments] = useState<EventComment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleDelete(commentId: string) {
    if (!confirm('Delete this comment?')) return;

    const res = await fetch(`/api/events/${eventId}/comments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId }),
    });

    if (res.ok) {
      fetchComments();
    } else {
      alert('Failed to delete comment.');
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/events/${eventId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to event
        </Link>
        <h1 className="text-2xl font-bold">Comments</h1>
        <p className="text-sm text-muted-foreground">
          {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{comment.author_name}</p>
                    {comment.is_private && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        Private
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatRelative(comment.created_at)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(comment.id)}
                  className="text-gray-400 hover:text-red-600"
                  aria-label="Delete comment"
                  tooltip="Delete comment"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{comment.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
