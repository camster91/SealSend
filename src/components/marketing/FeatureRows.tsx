import Image from "next/image";
import { cn } from "@/lib/utils";
import DigitalInvitationVisual from "@/components/marketing/DigitalInvitationVisual";

type Feature = {
  title: string;
  text: string;
  icon: string;
} & (
  | { visual: true; image?: never; alt?: never }
  | { visual?: false; image: string; alt: string }
);

const features: Feature[] = [
  {
    title: "A digital invitation worth opening.",
    text: "Pick a design, add your photo and colours, and preview exactly what guests will see.",
    visual: true,
    icon: "/brand/icons/invitation.svg",
  },
  {
    title: "Every reply in one place.",
    text: "See who's coming, who hasn't answered, plus-ones and dietary needs, updated the moment a guest replies.",
    image: "/brand/photos/track-rsvps.webp",
    alt: "A host at a kitchen table reading a guest list that shows who is going, who might come and dietary notes",
    icon: "/brand/icons/rsvp.svg",
  },
  {
    title: "Change of plans? Tell everyone at once.",
    text: "Send an update by email to everyone, or only to guests who said yes.",
    image: "/brand/photos/guest-updates.webp",
    alt: "A guest outside a community hall holding a phone with an update from the hosts: doors open at 6:30, parking is behind the hall",
    icon: "/brand/icons/message.svg",
  },
  {
    title: "A calm front door.",
    text: "Scan guests in from any phone and see arrivals live.",
    image: "/brand/photos/door-checkin.webp",
    alt: "A volunteer at a welcome table scanning the QR code on a guest's phone as she arrives",
    icon: "/brand/icons/checkin.svg",
  },
];

export default function FeatureRows() {
  return (
    <section aria-labelledby="features-title" className="bg-white px-4 py-12 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 id="features-title" className="sr-only">
          What SealSend does
        </h2>
        <div className="space-y-12 sm:space-y-28">
          {features.map((feature, index) => (
            <div key={feature.title} className="grid items-center gap-5 sm:gap-8 lg:grid-cols-12 lg:gap-16">
              <div
                className={cn(
                  "relative rounded-2xl border border-border lg:col-span-7",
                  !feature.visual && "aspect-[4/3] overflow-hidden",
                  index % 2 === 1 && "lg:order-2",
                )}
              >
                {feature.visual ? (
                  <DigitalInvitationVisual compact />
                ) : (
                  <Image
                    src={feature.image}
                    alt={feature.alt}
                    fill
                    sizes="(min-width: 1280px) 720px, (min-width: 1024px) 58vw, 100vw"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="lg:col-span-5">
                {/* On phones the photo directly above carries the row, so the icon only shows from sm. */}
                <Image src={feature.icon} alt="" width={56} height={56} className="hidden h-14 w-14 sm:mb-6 sm:block" />
                <h3 className="font-display text-3xl text-ink sm:text-4xl">{feature.title}</h3>
                <p className="mt-3 max-w-md leading-relaxed text-neutral-600 sm:mt-4 sm:text-lg">{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
