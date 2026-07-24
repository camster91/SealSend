"use client";

import { Share2, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Event } from "@/types/database";
import { isValidHexColor } from "@/lib/utils";
import { sanitizeUrl } from "@/lib/sanitize";

interface EventHeroProps {
  event: Event;
}

function isVideo(event: Event): boolean {
  return (
    event.design_type === "video" ||
    /\.(mp4|webm)$/i.test(event.design_url || "")
  );
}

export function EventHero({ event }: EventHeroProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const primaryColor = isValidHexColor(event.customization?.primaryColor ?? "")
    ? event.customization.primaryColor
    : "#7c3aed";
  const logoUrl = sanitizeUrl(event.customization?.logoUrl);
  const designUrl = sanitizeUrl(event.design_url);

  const handleShare = async () => {
    const url = window.location.href;
    const title = event.title;
    const text = event.description || `You are invited to ${event.title}!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
      } catch {
        // User cancelled share sheet — ignore
      }
    } else {
      // Fallback to copy link
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Logo */}
      {logoUrl && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={`${event.title} logo`}
            className="h-16 w-auto object-contain sm:h-20"
          />
        </div>
      )}

      {/* Share Action Bar */}
      <div className="flex justify-end mb-2">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors shadow-sm bg-white/90 hover:bg-white text-gray-800 backdrop-blur-sm border border-gray-200"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
          {copied ? "Link Copied!" : "Share Invite"}
        </button>
      </div>

      {/* Design */}
      {!designUrl ? (
        <div
          className="flex h-64 items-center justify-center rounded-xl"
          style={{ backgroundColor: primaryColor + "20" }}
        >
          <h1
            className="text-3xl font-bold"
            style={{ color: primaryColor }}
          >
            {event.title}
          </h1>
        </div>
      ) : isVideo(event) ? (
        <div className="overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5">
          <video
            src={designUrl}
            autoPlay
            muted
            loop
            playsInline
            className="h-auto w-full object-cover"
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={designUrl}
            alt={event.title}
            className="h-auto w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
