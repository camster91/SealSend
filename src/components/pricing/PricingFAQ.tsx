"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BETA_MODE } from "@/lib/constants";

const betaFaqs = [
  {
    question: "What is included in the controlled beta?",
    answer:
      "A controlled beta account can run one active event for up to 100 guests, including the shipped invitation, RSVP, guest-management, communications, co-host, analytics, and check-in tools.",
  },
  {
    question: "Will I be charged during the beta?",
    answer:
      "No. Paid checkout is disabled during the controlled beta, and SealSend does not ask for a payment card.",
  },
  {
    question: "Are guest communications sent automatically?",
    answer:
      "No. The host reviews and deliberately starts external email or SMS communications. Provider delivery is verified with each approved beta host before live use.",
  },
  {
    question: "Do guests need an account or app?",
    answer:
      "No. Guests use the published event link in a browser to review details and submit their RSVP.",
  },
];

const paidFaqs = [
  {
    question: "What is the difference between an event upgrade and annual Pro?",
    answer:
      "An Event Pass is a one-time upgrade for a single event: up to 250 guests, SMS, every event feature, and no SealSend badge. Annual Pro covers unlimited events for one year, with up to 2,500 guests per event.",
  },
  {
    question: "What happens when I hit my event or guest limit?",
    answer:
      "SealSend stops new guests or responses at the event's limit. You can upgrade that event, or use annual Pro for the highest capacity.",
  },
  {
    question: "Does canceling Pro change event upgrades I already purchased?",
    answer:
      "No. An event with its own Event Pass (or an earlier one-time upgrade) keeps its capacity after annual Pro ends.",
  },
  {
    question: "How many events can I create for free?",
    answer:
      "A free account can create one event for up to 50 guests, with email invitations. Annual Pro allows unlimited events during the active subscription.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "Checkout is securely processed by Stripe. The payment methods shown at checkout depend on the methods enabled for SealSend's Stripe account.",
  },
];

export function PricingFAQ() {
  const faqs = BETA_MODE ? betaFaqs : paidFaqs;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-neutral-50 px-4 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
            <HelpCircle className="h-6 w-6 text-primary-600" />
          </div>
          <h2 className="font-display text-3xl font-bold text-neutral-900">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-neutral-600">
            {BETA_MODE ? "What to expect from the controlled beta" : "Everything you need to know about pricing and billing"}
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <button
                aria-expanded={openIndex === index}
                aria-controls={`pricing-faq-answer-${index}`}
                onClick={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
                className="flex w-full items-center justify-between p-6 text-left"
              >
                <span className="font-medium text-neutral-900">
                  {faq.question}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-neutral-500 transition-transform duration-200",
                    openIndex === index && "rotate-180"
                  )}
                />
              </button>
              <div
                id={`pricing-faq-answer-${index}`}
                hidden={openIndex !== index}
                className={cn(
                  "grid transition-all duration-200",
                  openIndex === index
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-6 text-neutral-600 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-12 rounded-2xl bg-primary-600 p-8 text-center text-white">
          <h3 className="font-display text-xl font-semibold">
            Still have questions?
          </h3>
          <p className="mt-2 text-primary-100">
            Email us with a pricing or billing question.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="mailto:support@sealsend.app"
              className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
