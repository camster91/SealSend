export type FirstEventChecklistEvent = {
  id: string;
  eventDate: string | null;
  locationName: string | null;
  maxAttendees: number | null;
  invitationHeadline: string | null;
  invitationBody: string | null;
  status: "draft" | "published" | "archived";
};

export type FirstEventChecklistStep = {
  label: string;
  complete: boolean;
  href: string;
};

type FirstEventChecklistInput = {
  event: FirstEventChecklistEvent | null;
  hasGuest: boolean;
  hasInvitation: boolean;
};

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function buildFirstEventChecklist({
  event,
  hasGuest,
  hasInvitation,
}: FirstEventChecklistInput): FirstEventChecklistStep[] {
  const editHref = event ? `/events/${event.id}/edit` : "/events/new";
  const eventHref = event ? `/events/${event.id}` : "/events/new";
  const guestsHref = event ? `/events/${event.id}/guests` : "/events/new";
  const hasEvent = Boolean(event);

  return [
    { label: "Create an event", complete: hasEvent, href: editHref },
    {
      label: "Confirm schedule, location, and capacity",
      complete: Boolean(
        event?.eventDate
        && hasText(event.locationName)
        && Number.isInteger(event.maxAttendees)
        && Number(event.maxAttendees) > 0,
      ),
      href: editHref,
    },
    {
      label: "Review invitation copy",
      complete: Boolean(
        hasText(event?.invitationHeadline ?? null)
        && hasText(event?.invitationBody ?? null),
      ),
      href: editHref,
    },
    { label: "Add your first guest", complete: hasEvent && hasGuest, href: guestsHref },
    { label: "Publish the event", complete: event?.status === "published", href: eventHref },
    {
      label: "Send the first invitation",
      complete: hasEvent && hasInvitation,
      href: guestsHref,
    },
  ];
}
