export type Host = { id: string; email: string | null; role: 'admin' };
export type Event = { id: string; title: string; description?: string; slug: string; event_date: string | null; event_end_date?: string | null; event_timezone: string; location_name: string | null; location_address?: string; host_name?: string; status: 'draft' | 'published' | 'archived' };
export type Attendee = { id: string; name: string; rsvp_status: string; checked_in_at: string | null; source: 'guest' | 'public_rsvp'; headcount: number };
export type Session = { sessionToken: string; expiresAt: string; user: Host };
export type Deletion = { status: 'pending' | 'cancelled' | 'completed'; scheduled_for: string };
export function invitationLink(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'sealsend.app' || url.port || url.username || url.password || url.hash || !/^\/e\/[a-zA-Z0-9_-]+$/.test(url.pathname)) return null;
    const keys = [...url.searchParams.keys()];
    if (keys.length && (keys.length !== 1 || keys[0] !== 't' || !/^[a-zA-Z0-9_-]{24}$/.test(url.searchParams.get('t') ?? ''))) return null;
    return url.toString();
  } catch { return null; }
}
export function qrToken(input: string, eventSlug: string): string | null {
  try {
    const url = new URL(input);
    if (!invitationLink(input) || url.pathname !== `/e/${eventSlug}`) return null;
    const token = url.searchParams.get('t');
    return token && /^[a-zA-Z0-9_-]{24}$/.test(token) ? token : null;
  } catch { return null; }
}
export function checkInBody(guest: Attendee) {
  return { [guest.source === 'public_rsvp' ? 'rsvpResponseId' : 'guestId']: guest.id, checkedIn: !guest.checked_in_at };
}
export function eventTime(event: Event): string {
  if (!event.event_date) return 'Date to be decided';
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: event.event_timezone }).format(new Date(event.event_date)); }
  catch { return 'Date unavailable'; }
}
