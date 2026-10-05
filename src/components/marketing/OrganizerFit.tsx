const alternatives: Array<{
  name: string;
  usefulWhen: string;
  sealSendFit: string;
}> = [
  {
    name: "Spreadsheets and group chats",
    usefulWhen: "The event is small and one person can reconcile every change manually.",
    sealSendFit: "Use SealSend when invitation details, replies, plus-ones, updates, and check-in need one event record.",
  },
  {
    name: "Invitation-first tools",
    usefulWhen: "Invitation design and a basic response count are the main job.",
    sealSendFit: "Use SealSend when the guest list must remain useful after the invitation is opened.",
  },
  {
    name: "Enterprise event platforms",
    usefulWhen: "Ticketing, sponsors, venues, or multi-event programs justify a larger system.",
    sealSendFit: "Use SealSend for a small team that runs the event from the invitation through check-in.",
  },
];

export default function OrganizerFit() {
  return (
    <section aria-labelledby="organizer-fit-title" className="border-y border-border bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <h2 id="organizer-fit-title" className="font-display text-4xl text-ink sm:text-5xl">
            Where SealSend fits
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-700">
            Choose the smallest tool that keeps the event under control.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-8">
          {alternatives.map((alternative) => (
            <article key={alternative.name} className="border-t border-border pt-6">
              <h3 className="text-xl font-semibold text-ink">{alternative.name}</h3>
              <p className="mt-3 leading-relaxed text-neutral-600">
                <strong className="font-semibold text-ink">Useful when:</strong> {alternative.usefulWhen}
              </p>
              <p className="mt-3 leading-relaxed text-neutral-600">
                <strong className="font-semibold text-ink">SealSend fit:</strong> {alternative.sealSendFit}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-10 max-w-3xl text-sm text-neutral-600">
          This is a product-scope comparison based on the features described here, not a claim about every competitor or live delivery performance.
        </p>
      </div>
    </section>
  );
}
