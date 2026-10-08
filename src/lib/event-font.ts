import { sanitizeFontFamily } from './sanitize';

/** Match look previews and invitations to self-hosted fonts and safe fallbacks. */
export function eventFontFamily(font: string | null | undefined): string {
  const safe = sanitizeFontFamily(font);
  if (safe === 'Inter') return 'var(--font-event-inter), sans-serif';
  if (safe === 'Poppins') return 'var(--font-event-poppins), sans-serif';
  if (safe === 'Georgia' || safe === 'Times New Roman') return `"${safe}", serif`;
  if (['serif', 'sans-serif', 'monospace', 'system-ui'].includes(safe)) return safe;
  return `"${safe}", sans-serif`;
}
