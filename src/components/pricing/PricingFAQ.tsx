"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When you upgrade, you'll be charged the prorated difference. When you downgrade, your new rate will take effect at the next billing cycle.",
  },
  {
    question: "What happens when I hit my event or guest limit?",
    answer:
      "You'll receive a friendly notification when you're approaching your limits. You can upgrade to a higher plan instantly, or archive old events to make room for new ones. Your existing events will always remain accessible.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes, we offer a 14-day money-back guarantee on all paid plans. If you're not satisfied, contact us within 14 days for a full refund, no questions asked.",
  },
  {
    question: "Can I use my own domain?",
    answer:
      "Yes! Pro and Business plans allow you to use a custom domain for your event pages (e.g., events.yourdomain.com). We provide SSL certificates automatically.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe. We also support PayPal for Business plans.",
  },
  {
    question: "Is there a discount for nonprofits or education?",
    answer:
      "Yes! We offer 50% off for registered nonprofits and educational institutions. Contact our support team with your organization details to apply.",
  },
  {
    question: "What happens to my data if I cancel?",
    answer:
      "Your data belongs to you. If you cancel, you can export all your guest lists, RSVPs, and event data. We'll keep your data for 30 days in case you change your mind, then it's permanently deleted.",
  },
  {
    question: "Do you offer team or enterprise plans?",
    answer:
      "Our Business plan supports teams up to 10 members. For larger organizations with custom needs, contact us for an Enterprise quote with dedicated support and custom features.",
  },
];

export function PricingFAQ() {
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
            Everything you need to know about pricing and billing
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <button
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
            Our team is here to help. Reach out and we&apos;ll get back to you within 24 hours.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="mailto:support@sealsend.app"
              className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
            >
              Contact Support
            </a>
            <a
              href="/help"
              className="inline-flex items-center justify-center rounded-lg border border-primary-400 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              Visit Help Center
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
