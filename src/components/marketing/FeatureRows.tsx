import Image from "next/image";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "An invitation worth opening.",
    text: "Pick a design, add your photo and colours, and preview exactly what guests will see.",
    image: "/brand/photos/design-invitation.webp",
    alt: "A wedding invitation with a wax seal and an RSVP button on a phone, beside paper colour swatches and a fountain pen",
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
    text: "Send an update by email or text to everyone, or only to guests who said yes.",
    image: "/brand/photos/guest-updates.webp",
    alt: "A guest outside a community hall holding a phone with a text from the hosts: doors open at 6:30, parking is behind the hall",
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
    <section aria-labelledby="features-title" className="bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 id="features-title" className="sr-only">
          What SealSend does
        </h2>
        <div className="space-y-20 sm:space-y-28">
          {features.map((feature, index) => (
            <div key={feature.title} className="grid items-center gap-8 lg:grid-cols-12 lg:gap-16">
              <div
                className={cn(
                  "relative aspect-[4/3] overflow-hidden rounded-2xl border border-border lg:col-span-7",
                  index % 2 === 1 && "lg:order-2",
                )}
              >
                <Image
                  src={feature.image}
                  alt={feature.alt}
                  fill
                  sizes="(min-width: 1280px) 720px, (min-width: 1024px) 58vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="lg:col-span-5">
                <Image src={feature.icon} alt="" width={56} height={56} className="h-14 w-14" />
                <h3 className="mt-6 font-display text-3xl text-ink sm:text-4xl">{feature.title}</h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-neutral-600">{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
