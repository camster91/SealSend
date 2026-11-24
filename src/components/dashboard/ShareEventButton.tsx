"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/** One share control: the phone's share menu when there is one, otherwise copy the link. */
export function ShareEventButton({ url, title }: { url: string; title: string }) {
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  async function share() {
    setMessage("");
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title, url }); } catch { /* The host closed the share menu. */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setMessage("Link copied. Paste it into a message or group chat.");
    } catch {
      setMessage("Couldn't copy. Select the link below instead.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={share}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 sm:w-auto"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
        Share invitation
      </button>
      <p role="status" className="text-sm text-neutral-700">{message}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all text-sm text-ink underline underline-offset-4">{url}</a>
    </div>
  );
}
