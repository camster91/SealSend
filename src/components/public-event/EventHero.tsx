"use client";

import { Share2, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Event } from "@/types/database";
import { isValidHexColor } from "@/lib/utils";
import { publicInviteUrl } from "@/lib/public-invite-url";
import { sanitizeUrl } from "@/lib/sanitize";
import { eventDisplayFontFamily } from "@/lib/event-font";
import { ThemeMotif } from "@/components/public-event/ThemeMotif";

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
  const [shareError, setShareError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const primaryColor = isValidHexColor(event.customization?.primaryColor ?? "")
    ? event.customization.primaryColor
    : "#7c3aed";
  const backgroundColor = isValidHexColor(event.customization?.backgroundColor ?? "")
    ? event.customization.backgroundColor
    : "#ffffff";
  const displayFont = eventDisplayFontFamily(
    event.customization?.displayFont,
    event.customization?.fontFamily,
  );
  const layoutStyle = event.customization?.layoutStyle ?? "classic";
  const motif = event.customization?.motif ?? "none";
  const logoUrl = sanitizeUrl(event.customization?.logoUrl);
  const designUrl = sanitizeUrl(event.design_url);
  const frameRadius =
    layoutStyle === "arch"
      ? "rounded-t-[200px] rounded-b-2xl"
      : layoutStyle === "editorial"
        ? "rounded-none"
        : "rounded-2xl";

  const handleShare = async () => {
    const url = publicInviteUrl(window.location.origin, event.slug);
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
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        setShareError(true);
        return;
      }
      setShareError(false);
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
      <div className="mb-2 flex items-center justify-end gap-3">
        {shareError && <p role="alert" className="rounded-full bg-white px-3 py-1 text-sm text-ink">Couldn&apos;t copy. Use the address bar instead.</p>}
        <button
          onClick={handleShare}
          className="flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors shadow-sm bg-white/90 hover:bg-white text-gray-800 backdrop-blur-sm border border-gray-200"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
          {copied ? "Link Copied!" : "Share Invite"}
        </button>
      </div>

      {/* Design */}
      {!designUrl ? (
        <div
          className={`relative flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-10 text-center sm:min-h-56 sm:px-10 sm:py-12 ${frameRadius} ${
            layoutStyle === "editorial"
              ? "border-y-2"
              : layoutStyle === "minimal"
                ? ""
                : "border shadow-sm"
          }`}
          style={{
            backgroundColor: layoutStyle === "minimal" ? "transparent" : `${primaryColor}12`,
            borderColor: layoutStyle === "minimal" ? "transparent" : `${primaryColor}38`,
          }}
        >
          {layoutStyle === "classic" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-2.5 rounded-xl border"
              style={{ borderColor: `${primaryColor}24` }}
            />
          )}
          <ThemeMotif motif={motif} color={primaryColor} title={event.title} />
          {event.host_name && layoutStyle === "editorial" && (
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80"
              style={{ color: primaryColor }}
            >
              {event.host_name}
            </p>
          )}
          <h1
            className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl"
            style={{ color: primaryColor, fontFamily: displayFont }}
          >
            {event.title}
          </h1>
          {event.invitation_headline && event.invitation_headline !== event.title && (
            <p
              className="max-w-xl text-sm opacity-85 sm:text-base"
              style={{ color: primaryColor }}
            >
              {event.invitation_headline}
            </p>
          )}
        </div>
      ) : isVideo(event) ? (
        <div className={`overflow-hidden shadow-lg ring-1 ring-black/5 ${frameRadius}`}>
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
        <div
          className={`overflow-hidden shadow-lg ring-1 ring-black/5 ${frameRadius}`}
          style={{ backgroundColor }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={designUrl}
            alt={event.title}
            className={`aspect-[4/3] w-full ${event.customization?.imageFit === 'cover' ? 'object-cover' : 'object-contain'}`}
            style={{ objectPosition: event.customization?.imagePosition ?? 'center' }}
          />
        </div>
      )}
    </div>
  );
}
