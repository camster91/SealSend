'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatRelative } from '@/lib/utils';
import type { EventComment } from '@/types/database';

interface CommentsSectionProps {
  eventSlug: string;
}

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-pink-500 to-rose-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
  'from-fuchsia-500 to-pink-600',
  'from-lime-500 to-green-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function CommentsSection({ eventSlug }: CommentsSectionProps) {
  const [comments, setComments] = useState<EventComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill name if user is signed in (runs once on mount)
  useEffect(() => {
    async function prefill() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        const user = data.user;
        if (user && !authorName) {
          const name = user.name || user.email?.split('@')[0] || '';
          if (name) setAuthorName(name);
        }
      } catch {
        // Not signed in, that's fine
      }
    }
  }, []);

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/comments/${eventSlug}`);
    if (res.ok) {
      const data = await res.json();
      setComments(data);
    }
    setLoading(false);
  }, [eventSlug]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !message.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/comments/${eventSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName.trim(),
          message: message.trim(),
          is_private: isPrivate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to post comment');
      }

      setMessage('');
      fetchComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-violet-50/60 to-pink-50/30 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Guest Messages</h2>
          <p className="text-xs text-gray-500">Leave a message for the host and guests</p>
        </div>
        {comments.length > 0 && (
          <span className="ml-auto rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
            {comments.length}
          </span>
        )}
      </div>

      {/* Post form */}
      <form onSubmit={handleSubmit} className="border-b border-gray-100 p-5 space-y-3">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300 text-xs font-bold text-white">
            {authorName ? authorName.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
              required
              autoComplete="name"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/20 placeholder:text-gray-400"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a message..."
              maxLength={1000}
              required
              rows={2}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/20 placeholder:text-gray-400 resize-none"
            />
          </div>
        </div>
        {/* Private message toggle */}
        <div className="flex items-center gap-2 pl-12">
          <button
            type="button"
            onClick={() => setIsPrivate(!isPrivate)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              isPrivate ? 'bg-violet-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ${
                isPrivate ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-xs text-gray-500">
            {isPrivate ? (
              <span className="flex items-center gap-1 text-violet-600 font-medium">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Private — only the host will see this
              </span>
            ) : (
              'Send as private message to host'
            )}
          </span>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !authorName.trim() || !message.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Posting...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Post
              </>
            )}
          </button>
        </div>
      </form>

      {/* Comments list */}
      <div className="p-5">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-3 border-violet-200 border-t-violet-600" />
          </div>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No messages yet</p>
            <p className="mt-0.5 text-xs text-gray-400">Be the first to leave one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-sm ${getAvatarColor(comment.author_name)}`}
                >
                  {comment.author_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 rounded-2xl rounded-tl-md bg-gray-50 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{comment.author_name}</p>
                    <p className="shrink-0 text-[10px] text-gray-400">{formatRelative(comment.created_at)}</p>
                  </div>
                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{comment.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
