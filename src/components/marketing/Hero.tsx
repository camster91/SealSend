import Image from "next/image";
import { SealMark } from "@/components/layout/Logo";
import { PRIMARY_CTA_NOTE, PrimaryCta, SecondaryCta } from "@/components/marketing/Cta";

// Server-rendered hero. The only motion on the page is the seal pressing in (CSS, 400ms),
// which is switched off under prefers-reduced-motion in globals.css.
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#e8ebf0]">
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8 xl:flex xl:min-h-[44rem] xl:items-center xl:py-20">
        <div className="max-w-xl xl:max-w-[28rem]">
          <SealMark className="animate-seal-press h-14 w-14" />
          <h1 className="mt-6 font-display text-[2.75rem] text-ink sm:text-6xl xl:text-[3.6rem]">
            Send the invitation. Know who&apos;s coming.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-700">
            SealSend handles the invitation, RSVPs, guest updates and check-in at the door. Your guests just tap a link, with no app or account to set up.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryCta />
            <SecondaryCta href="/how-it-works">See how it works</SecondaryCta>
          </div>
          <p className="mt-4 text-sm text-neutral-600">{PRIMARY_CTA_NOTE}</p>
        </div>
      </div>

      {/* Below xl the photo stacks under the copy, cropped to the envelope and phone. From xl it runs
          full-bleed behind the copy, which sits on the photo's empty left third. */}
      <div className="relative mt-8 aspect-[4/3] sm:mt-10 w-full sm:aspect-[16/9] xl:absolute xl:inset-0 xl:mt-0 xl:aspect-auto">
        <Image
          src="/brand/photos/hero-stationery.webp"
          alt="A cream wedding invitation in an envelope sealed with a red wax S, beside a phone listing guests who are going"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[78%_center] sm:object-[70%_center] xl:object-center"
        />
      </div>
    </section>
  );
}
