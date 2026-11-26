import type { EventMotif } from "@/types/database";

interface ThemeMotifProps {
  motif?: EventMotif;
  color: string;
  title?: string;
}

function monogramLetters(title?: string): string {
  if (!title) return "S";
  const words = title
    .replace(/[^A-Za-z0-9&\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w && w !== "&" && w.toLowerCase() !== "the" && w.toLowerCase() !== "and");
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return (words[0]?.slice(0, 2) || "S").toUpperCase();
}

/** Subtle inline SVG stationery ornaments. Purely decorative (aria-hidden). */
export function ThemeMotif({ motif, color, title }: ThemeMotifProps) {
  if (!motif || motif === "none") return null;

  if (motif === "botanical") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 120 28"
        className="mx-auto h-6 w-28 opacity-70"
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 14h34M74 14h34" opacity="0.45" />
        <path d="M60 22c0-7 4-13 10-16-1 6-4 11-10 16Z" />
        <path d="M60 22c0-7-4-13-10-16 1 6 4 11 10 16Z" />
        <circle cx="60" cy="6" r="1.5" fill={color} stroke="none" />
      </svg>
    );
  }

  if (motif === "celestial") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 120 28"
        className="mx-auto h-6 w-28 opacity-75"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
      >
        <path d="M14 14h32M74 14h32" opacity="0.4" />
        <path
          d="M60 4l2.2 7.8L70 14l-7.8 2.2L60 24l-2.2-7.8L50 14l7.8-2.2L60 4Z"
          fill={color}
          fillOpacity="0.18"
        />
        <circle cx="42" cy="14" r="1.4" fill={color} stroke="none" />
        <circle cx="78" cy="14" r="1.4" fill={color} stroke="none" />
      </svg>
    );
  }

  if (motif === "monogram") {
    const letters = monogramLetters(title);
    return (
      <div
        aria-hidden="true"
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border text-xs font-semibold tracking-[0.18em]"
        style={{ borderColor: `${color}66`, color }}
      >
        {letters}
      </div>
    );
  }

  if (motif === "frame") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 120 18"
        className="mx-auto h-4 w-28 opacity-65"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
      >
        <path d="M10 9h38M72 9h38" opacity="0.5" />
        <rect x="55" y="4" width="10" height="10" transform="rotate(45 60 9)" />
      </svg>
    );
  }

  return null;
}
