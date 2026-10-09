import Image from "next/image";
import { SecondaryCta } from "./Cta";

export default function GoodCompany() {
  return (
    <section aria-labelledby="good-company-title" className="bg-[#f2d875]/20 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-2 lg:gap-16">
        <Image src="/brand/illustrations/good-company.webp" alt="Neighbours sharing a colourful meal under string lights" width={1000} height={672} sizes="(min-width: 1024px) 50vw, 100vw" className="h-auto w-full rounded-[2rem]" />
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-wax">More gathering. Less juggling.</p>
          <h2 id="good-company-title" className="mt-4 font-display text-4xl text-ink sm:text-5xl">Make room for good company.</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-neutral-700">The club catch-up. The neighbourhood dinner. The birthday that turned into a dance party. Whatever brings you together, keep the invitation and every reply in one place.</p>
          <SecondaryCta href="/use-cases" className="mt-7">Find your kind of gathering</SecondaryCta>
        </div>
      </div>
    </section>
  );
}
