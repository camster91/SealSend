import type { CheckInGuest } from "./check-in-store";

type Arrival = Pick<CheckInGuest, "name" | "rsvp_status" | "headcount" | "checked_in_at">;

/** People, not entries: a group counts everyone in it, and guests who declined aren't expected. */
export function arrivalCounts(guests: Arrival[]): { here: number; toCome: number } {
  let here = 0;
  let toCome = 0;
  for (const guest of guests) {
    if (guest.checked_in_at) here += guest.headcount;
    else if (guest.rsvp_status === "attending") toCome += guest.headcount;
  }
  return { here, toCome };
}

function rank(guest: Arrival): number {
  if (guest.checked_in_at) return 2;
  return guest.rsvp_status === "not_attending" ? 1 : 0;
}

/** People still to come first, so the list doesn't push them down as others arrive. */
export function sortForDoor<T extends Arrival>(guests: T[]): T[] {
  return [...guests].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
