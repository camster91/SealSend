export type FirstEventChecklistEvent = {
  id: string;
  eventDate: string | null;
  locationName: string | null;
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
};

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function buildFirstEventChecklist({
  event,
  hasGuest,
}: FirstEventChecklistInput): FirstEventChecklistStep[] {
  const editHref = event ? `/events/${event.id}/edit` : "/events/new";
  const eventHref = event ? `/events/${event.id}` : "/events/new";
  const guestsHref = event ? `/events/${event.id}/guests` : "/events/new";
  const hasEvent = Boolean(event);

  return [
    { label: "Create an event", complete: hasEvent, href: editHref },
    {
      label: "Set the date and place",
      complete: Boolean(event?.eventDate && hasText(event.locationName)),
      href: editHref,
    },
    { label: "Add your first guest", complete: hasEvent && hasGuest, href: guestsHref },
    { label: "Publish the event", complete: event?.status === "published", href: eventHref },
  ];
}
