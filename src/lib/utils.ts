import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/^-|-$/g, "");
  return `${base}-${nanoid(8)}`;
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: string | Date, timeZone?: string): string {
  if (!timeZone) return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(new Date(date));
  } catch {
    return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
  }
}

function formatParts(date: string | Date, timeZone: string | undefined, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, ...(timeZone ? { timeZone } : {}) }).format(new Date(date));
  } catch {
    return new Intl.DateTimeFormat('en-US', options).format(new Date(date));
  }
}

export function formatEventDay(date: string | Date, timeZone?: string): string {
  return formatParts(date, timeZone, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatShortDay(date: string | Date, timeZone?: string): string {
  return formatParts(date, timeZone, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatEventTime(date: string | Date, timeZone?: string): string {
  return formatParts(date, timeZone, { hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZoneName: 'short' } : {}) });
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

export function isValidRelativePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes(":")) {
    return false;
  }
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  try {
    const parsed = new URL(path, "https://sealsend.invalid");
    return parsed.origin === "https://sealsend.invalid" && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}
