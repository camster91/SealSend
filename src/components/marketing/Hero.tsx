import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="gradient-brand relative overflow-hidden px-4 py-24 text-white sm:py-32">
      <div className="mx-auto max-w-4xl text-center">
        {/* Social proof badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
          Trusted by 10,000+ event organizers
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          Beautiful Digital Invitations Your Guests Will Love
        </h1>

        {/* Subheading */}
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
          Design stunning invitations, collect RSVPs instantly, and manage your event
          &mdash; all in one place. No stamps, no stress.
        </p>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-600 shadow-lg transition hover:bg-white/90"
          >
            Create Your First Invitation &mdash; It&apos;s Free
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
          >
            See How It Works
          </Link>
        </div>
      </div>
    </section>
  );
}
