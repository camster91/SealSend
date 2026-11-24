// A real sequence, so the steps are numbered.
export const HOW_IT_WORKS_STEPS = [
  {
    title: "Describe your event.",
    text: "Add the name, date and place, and pick a design.",
  },
  {
    title: "Send it your way.",
    text: "Share one link in the group chat, or anywhere else.",
  },
  {
    title: "Watch replies arrive, then check guests in.",
    text: "See who's coming, plus-ones and allergies. Tap names off at the door.",
  },
];

export default function HowItWorks({ title = "How it works" }: { title?: string }) {
  return (
    <section id="how-it-works" className="px-4 py-12 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="max-w-2xl font-display text-4xl text-ink sm:text-5xl">{title}</h2>
        <ol className="mt-8 grid gap-8 sm:mt-12 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <li key={step.title} className="rounded-3xl border border-ink/10 bg-white p-6 sm:p-8">
              <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#f2d875]/50 font-display text-4xl text-ink">
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
