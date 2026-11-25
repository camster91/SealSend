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
  try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: event.event_timezone }).format(new Date(event.event_date)); }
  catch { return 'Date unavailable'; }
}
/** People, not entries: a group counts everyone in it, and guests who declined aren't expected. */
export function arrivalCounts(guests: Attendee[]) {
  let here = 0, toCome = 0;
  for (const guest of guests) {
    if (guest.checked_in_at) here += guest.headcount;
    else if (guest.rsvp_status === 'attending') toCome += guest.headcount;
  }
  return { here, toCome };
}
const doorRank = (guest: Attendee) => guest.checked_in_at ? 2 : guest.rsvp_status === 'not_attending' ? 1 : 0;
export function sortForDoor(guests: Attendee[]): Attendee[] {
  return [...guests].sort((a, b) => doorRank(a) - doorRank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
export function replyTotals(guests: Attendee[]) {
  const totals = { yes: 0, no: 0, maybe: 0, waiting: 0 };
  for (const guest of guests) {
    if (guest.rsvp_status === 'attending') totals.yes += guest.headcount;
    else if (guest.rsvp_status === 'not_attending') totals.no += 1;
    else if (guest.rsvp_status === 'maybe') totals.maybe += 1;
    else totals.waiting += 1;
  }
  return totals;
}
export function rsvpLabel(guest: Attendee): string {
  const reply = guest.rsvp_status === 'attending' ? 'Said yes' : guest.rsvp_status === 'not_attending' ? 'Said no' : guest.rsvp_status === 'maybe' ? 'Said maybe' : 'No reply yet';
  return guest.headcount > 1 ? `${reply} · ${guest.headcount} people` : reply;
}
export function nextHour(from: Date): Date {
  const next = new Date(from);
  next.setMinutes(60, 0, 0);
  return next;
}
export type WalkIn = { name: string; walkInId: string };
/** Keeps the same id while the same name is retried, so a lost reply can't add someone twice. */
export function walkInFor(previous: WalkIn | null, name: string, makeId: () => string): WalkIn {
  const clean = name.trim();
  return previous?.name === clean ? previous : { name: clean, walkInId: makeId() };
}
export function backFrom(screen: string): 'welcome' | 'events' | 'event' {
  if (screen === 'check-in' || screen === 'edit') return 'event';
  return screen === 'login' ? 'welcome' : 'events';
}
