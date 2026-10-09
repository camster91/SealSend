import { cn } from "@/lib/utils";

interface DigitalInvitationVisualProps {
  /** Use the compact treatment in a feature row while keeping the same visual language as the hero. */
  compact?: boolean;
  className?: string;
}

/**
 * A CSS illustration of a digital invitation. It deliberately has no controls
 * or links: every label is sample content, so the visual cannot impersonate
 * a live invitation or suggest that a guest action has been submitted.
 */
export default function DigitalInvitationVisual({ compact = false, className }: DigitalInvitationVisualProps) {
  return (
    <figure
      aria-label="Illustrative example of an online invitation with sample replies"
      className={cn("relative w-full", compact ? "min-h-[16rem]" : "min-h-[25rem]", className)}
    >
      <div
        aria-hidden="true"
        className={cn(
          "relative isolate flex h-full min-h-[inherit] items-center overflow-hidden rounded-[2rem] border border-[#1b2a4a]/10 bg-[#f2ecff] p-4 shadow-[0_18px_50px_-30px_rgba(27,42,74,0.55)] sm:p-7",
          compact && "rounded-2xl p-3 sm:p-5",
        )}
      >
        <span className="absolute -right-12 -top-12 -z-10 h-32 w-32 rounded-full bg-[#f2d875]/75" />
        <span className="absolute -bottom-16 -left-10 -z-10 h-36 w-36 rounded-full bg-[#b7d7c1]/80" />
        <div className={cn("mx-auto grid w-full max-w-3xl items-center gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:gap-5", compact && "sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-3")}>
          <div className="overflow-hidden rounded-2xl border border-[#1b2a4a]/15 bg-white shadow-[0_12px_28px_-20px_rgba(27,42,74,0.8)]">
            <div className="flex h-8 items-center gap-1.5 border-b border-[#1b2a4a]/10 bg-[#fbfaf7] px-3">
              <span className="h-2 w-2 rounded-full bg-[#ed8d74]" />
              <span className="h-2 w-2 rounded-full bg-[#f2d875]" />
              <span className="h-2 w-2 rounded-full bg-[#b7d7c1]" />
              <span className="ml-2 truncate text-[0.6rem] font-semibold tracking-wide text-[#1b2a4a]/80">sealsend.app / invitation</span>
            </div>
            <div className={cn("bg-[#fbfaf7] p-3 sm:p-5", compact && "p-3 sm:p-4")}>
              <div className="mx-auto max-w-[22rem] rounded-xl border border-[#1b2a4a]/10 bg-white p-4 text-center shadow-sm sm:p-5">
                <span className="inline-flex rounded-full bg-[#f2d875]/45 px-2.5 py-1 text-[0.55rem] font-bold uppercase tracking-[0.16em] text-[#1b2a4a]">
                  Online invitation
                </span>
                <p className="mt-3 font-display text-xl leading-tight text-[#1b2a4a] sm:text-2xl">Sam&apos;s summer birthday</p>
                <p className="mt-2 text-xs leading-relaxed text-[#1b2a4a]/80">Saturday, August 16 · 6:30 pm<br />The garden behind the house</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#b7d7c1]/45">
                  <span className="block h-full w-3/4 rounded-full bg-[#759d82]" />
                </div>
                <p className="mt-2 text-[0.65rem] font-semibold text-[#1b2a4a]/80">18 yes · 4 maybe · 2 can&apos;t make it</p>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[10rem] rounded-[1.35rem] border-[5px] border-[#1b2a4a] bg-[#fbfaf7] p-2 shadow-[0_15px_28px_-18px_rgba(27,42,74,0.9)]">
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-[#1b2a4a]/45" />
            <div className="rounded-[0.8rem] bg-white p-2.5">
              <span className="inline-flex rounded-full bg-[#d9c9f4] px-2 py-1 text-[0.48rem] font-bold uppercase tracking-wide text-[#1b2a4a]">Sample replies</span>
              <p className="mt-3 text-[0.7rem] font-bold leading-tight text-[#1b2a4a]">Who&apos;s coming?</p>
              <div className="mt-2 space-y-1.5 text-[0.55rem] font-semibold text-[#1b2a4a]/75">
                <span className="block rounded-md bg-[#b7d7c1]/45 px-2 py-1.5">Yes · 18</span>
                <span className="block rounded-md bg-[#f2d875]/40 px-2 py-1.5">Maybe · 4</span>
                <span className="block rounded-md bg-[#ed8d74]/20 px-2 py-1.5">Can&apos;t make it · 2</span>
              </div>
            </div>
            <span className="mx-auto mt-2 block h-1 w-8 rounded-full bg-[#1b2a4a]/30" />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs font-medium text-neutral-600">
        Illustrative example · sample replies shown, not a live invitation.
      </figcaption>
    </figure>
  );
}
