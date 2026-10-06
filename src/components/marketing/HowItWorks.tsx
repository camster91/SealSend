// A real sequence, so the steps are numbered.
export const HOW_IT_WORKS_STEPS = [
  {
    title: "Describe your event.",
    text: "Paste the details or start from a template, and SealSend drafts the invitation.",
  },
  {
    title: "Send it your way.",
    text: "By email, or as a link you share anywhere.",
  },
  {
    title: "Watch replies arrive, then check guests in.",
    text: "Live counts, dietary notes and plus-ones, and a QR scan at the door.",
  },
];

export default function HowItWorks({ title = "How it works" }: { title?: string }) {
  return (
    <section id="how-it-works" className="px-4 py-12 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="max-w-2xl font-display text-4xl text-ink sm:text-5xl">{title}</h2>
        <ol className="mt-8 grid gap-8 sm:mt-12 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <li key={step.title} className="border-t border-foil pt-5 sm:pt-6">
              <span aria-hidden="true" className="font-display text-4xl text-ink sm:text-5xl">
                {index + 1}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-ink">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2 max-w-sm leading-relaxed text-neutral-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
