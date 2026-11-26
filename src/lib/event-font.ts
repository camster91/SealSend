import { sanitizeFontFamily } from './sanitize';

/** Match look previews and invitations to self-hosted fonts and safe fallbacks. */
export function eventFontFamily(font: string | null | undefined): string {
  const safe = sanitizeFontFamily(font);
  if (safe === 'Inter') return 'var(--font-event-inter), sans-serif';
  if (safe === 'Poppins') return 'var(--font-event-poppins), sans-serif';
  if (safe === 'DM Sans') return 'var(--font-event-dm-sans), sans-serif';
  if (safe === 'Cormorant Garamond') return 'var(--font-event-cormorant), Georgia, serif';
  if (safe === 'Playfair Display') return 'var(--font-event-playfair), Georgia, serif';
  if (safe === 'Fraunces') return 'var(--font-event-fraunces), Georgia, serif';
  if (safe === 'Libre Caslon Display') return 'var(--font-caslon), Georgia, serif';
  if (safe === 'Georgia' || safe === 'Times New Roman') return `"${safe}", serif`;
  if (['serif', 'sans-serif', 'monospace', 'system-ui'].includes(safe)) return safe;
  return `"${safe}", sans-serif`;
}

export function eventDisplayFontFamily(displayFont: string | null | undefined, fallbackBodyFont?: string | null): string {
  return eventFontFamily(displayFont || fallbackBodyFont || 'Inter');
}
