import { TIERS, BETA_MODE } from "@/lib/constants";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import Link from "next/link";

const tierOrder = ["free", "standard", "premium"] as const;

export default function PricingCards() {
  if (BETA_MODE) {
    return (
      <section className="py-16 px-4">
        <div className="mx-auto max-w-3xl">
          {/* Beta banner */}
          <div className="mb-8 rounded-2xl border-2 border-brand-200 bg-gradient-to-r from-brand-50 to-indigo-50 p-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-bold text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              BETA — Everything Free
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              All Premium Features, Completely Free
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-gray-600">
              We&apos;re in beta! Enjoy unlimited events, SMS invites, guest tags,
              announcements, sign-up boards, and up to 1,200 replies per event
              &mdash; all at no cost while we refine the experience.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-brand-700"
            >
              Get Started Free
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>

          {/* What's included */}
          <div className="rounded-2xl bg-neutral-900 p-6 sm:p-10">
            <h4 className="mb-6 text-center text-lg font-bold text-white">Everything included during Beta</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Unlimited events",
                "Up to 1,200 guest replies per event",
                "Email invitations via Mailgun",
                "SMS invitations via Twilio",
                "Guest tags & organization",
                "Announcements to all guests",
                "Sign-up board for contributions",
                "Custom colors, fonts & branding",
                "Video & slideshow invitations",
                "Add-to-calendar buttons",
                "RSVP tracking & analytics",
                "No SealSend branding",
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-white">
                  <Check className="h-4 w-4 shrink-0 text-green-400" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 px-4">
      <div className="mx-auto max-w-6xl rounded-2xl bg-neutral-900 p-6 sm:p-10">
        <div className="grid gap-6 md:grid-cols-3">
          {tierOrder.map((key) => {
            const tier = TIERS[key];
            const isPremium = key === "premium";
            const isStandard = key === "standard";
            const highlighted = isStandard;

            return (
              <Card
                key={key}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-xl bg-white text-neutral-900",
                  highlighted && "ring-2 ring-brand-600"
                )}
              >
                {/* Header area */}
                <div
                  className={cn(
                    "px-6 pt-6 pb-4",
                    highlighted && "bg-brand-50"
                  )}
                >
                  <span
                    className={cn(
                      "mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold",
                      highlighted
                        ? "bg-brand-100 text-brand-700"
                        : isPremium
                          ? "bg-green-100 text-green-700"
                          : "bg-neutral-100 text-neutral-700"
                    )}
                  >
                    {tier.tagline}
                  </span>

                  <h3 className="text-xl font-bold">{tier.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tier.replyLabel}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {tier.description}
                  </p>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-2 px-6 py-4">
                  <span className="text-3xl font-extrabold tracking-tight">
                    ${tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tier.price === 0 ? "forever" : "per event"}
                  </span>
                  {"badge" in tier && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-brand-100/80 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                      {tier.badge}
                    </span>
                  )}
                </div>

                {/* CTA Button */}
                <div className="px-6 pb-4">
                  <Link
                    href="/signup"
                    className={cn(
                      "block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors",
                      highlighted
                        ? "bg-brand-600 text-white hover:bg-brand-700"
                        : isPremium
                          ? "bg-neutral-900 text-white hover:bg-neutral-800"
                          : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    )}
                  >
                    {tier.price === 0
                      ? "Get Started"
                      : `Upgrade for $${tier.price}`}
                  </Link>
                </div>

                {/* Divider */}
                <hr className="mx-6 border-neutral-200" />

                {/* Features */}
                <ul className="flex flex-1 flex-col gap-3 px-6 py-5">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      <span>
                        <strong>{feature.title}</strong>
                        {feature.description && (
                          <span className="text-muted-foreground">
                            {" "}
                            &mdash; {feature.description}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {"footnote" in tier && (
                  <p className="px-6 pb-4 text-xs text-muted-foreground">
                    {tier.footnote}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
