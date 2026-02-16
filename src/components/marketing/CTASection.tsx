import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section className="gradient-brand px-4 py-20 text-white">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to create your first invitation?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
          Join thousands of hosts who trust us to make their events
          unforgettable. No credit card required.
        </p>

        <Link
          href="/signup"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 text-base font-semibold text-brand-600 shadow-lg transition hover:bg-white/90"
        >
          Get started for free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
