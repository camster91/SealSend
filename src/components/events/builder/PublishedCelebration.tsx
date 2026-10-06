"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useReducedMotion } from "framer-motion";

const BUTTON = "inline-flex min-h-11 items-center justify-center rounded-[10px] px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

/** Shown once an invite goes live: the seal presses in, then the host copies the link or adds guests. */
export function PublishedCelebration({ eventId, slug }: { eventId: string; slug: string }) {
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState("");

  const copyLink = async () => {
    const url = `${window.location.origin}/e/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("Link copied");
    } catch {
      setCopied("Could not copy. Select the link above and copy it.");
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-white p-6 text-center font-sans sm:p-8">
      <span
        aria-hidden="true"
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-wax text-white ${reduceMotion ? "" : "animate-seal-press"}`}
      >
        <Check className="h-8 w-8" />
      </span>
      <div>
        <h1 className="font-display text-3xl text-ink">Your invite is live</h1>
        <p className="mt-2 break-all text-base text-muted-foreground">{`/e/${slug}`}</p>
      </div>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={() => void copyLink()} className={`${BUTTON} border border-ink bg-white text-ink`}>Copy link</button>
        <Link href={`/events/${eventId}/guests`} className={`${BUTTON} bg-ink text-white`}>Add guests</Link>
      </div>
      <p aria-live="polite" className="text-sm font-medium text-ink empty:hidden">{copied}</p>
      <Link href={`/events/${eventId}`} className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
        Go to your event page
      </Link>
    </div>
  );
}
