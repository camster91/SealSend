import { Plus } from "lucide-react";

export interface Faq {
  question: string;
  answer: string;
}

/** FAQPage structured data for the same questions shown on the page. */
export function faqJsonLd(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

// Native <details> so answers work without JavaScript and keep their keyboard behaviour.
export default function FaqList({
  faqs,
  title = "Questions, answered",
  children,
}: {
  faqs: Faq[];
  title?: string;
  /** Optional note under the answers, such as a support contact. */
  children?: React.ReactNode;
}) {
  return (
    <section className="px-4 py-12 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 sm:gap-10 lg:grid-cols-12">
        <h2 className="font-display text-4xl text-ink sm:text-5xl lg:col-span-4">{title}</h2>
        <div className="border-t border-border lg:col-span-8">
          {faqs.map((faq) => (
            <details key={faq.question} className="group border-b border-border">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-lg font-medium text-ink [&::-webkit-details-marker]:hidden">
                {faq.question}
                <Plus
                  className="h-5 w-5 shrink-0 text-neutral-600 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-2xl pb-6 leading-relaxed text-neutral-700">{faq.answer}</p>
            </details>
          ))}
          {children && <div className="pt-6 text-neutral-700">{children}</div>}
        </div>
      </div>
    </section>
  );
}
