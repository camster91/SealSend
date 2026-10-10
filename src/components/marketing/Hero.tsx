import { SealMark } from "@/components/layout/Logo";
import { PRIMARY_CTA_NOTE, PrimaryCta, SecondaryCta } from "@/components/marketing/Cta";
import DigitalInvitationVisual from "@/components/marketing/DigitalInvitationVisual";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#faf7f0]">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:gap-6 lg:px-8 lg:py-20">
        <div className="lg:col-span-5">
          <p className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-[#f2d875]/35 px-4 py-2 text-sm font-semibold text-ink"><SealMark className="animate-seal-press h-6 w-6 shrink-0" />Online invitations</p>
          <h1 className="mt-6 font-display text-[2.75rem] leading-[1.06] text-ink sm:text-6xl">Send the invitation. Know who&apos;s coming.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-700">Plan the food, the seats, and the warm welcome. Make a digital invitation for your birthday, club night or neighbourhood dinner, then keep every reply in one place.</p>
          <p className="mt-4 text-neutral-600">Your guests just tap a link. No app or account needed.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <PrimaryCta />
            <SecondaryCta href="#try-invitation">Try a sample invitation</SecondaryCta>
          </div>
          <p className="mt-4 text-sm text-neutral-600">{PRIMARY_CTA_NOTE}</p>
        </div>
        <div className="lg:col-span-7">
          <DigitalInvitationVisual />
        </div>
      </div>
    </section>
  );
}
