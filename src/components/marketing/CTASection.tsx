import { SealMark } from "@/components/layout/Logo";
import { PrimaryCta } from "@/components/marketing/Cta";

export default function CTASection() {
  return (
    <section className="bg-ink px-4 py-14 text-white sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <SealMark className="h-12 w-12" />
        <h2 className="mt-6 font-display text-4xl sm:text-5xl">Your next event, sealed and sent.</h2>
        <p className="mt-4 text-lg text-white/80">Free for your first event.</p>
        <PrimaryCta onInk className="mt-8" />
      </div>
    </section>
  );
}
