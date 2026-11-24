import Image from "next/image";
import { cn } from "@/lib/utils";

// Real screens from the app with sample data, taken at phone size.
const features = [
  {
    title: "An invitation worth opening.",
    text: "Pick a design, add your photo and colours, and preview exactly what guests will see. They reply from the same page.",
    image: "/brand/screens/invitation.webp",
    alt: "A SealSend invitation on a phone for a garden summer party, with the date, place and a reply button",
  },
  {
    title: "Every reply in one place.",
    text: "See who said yes, no or maybe, and who hasn't answered. Plus-ones and allergies are there when guests tell you.",
    image: "/brand/screens/replies.webp",
    alt: "The event page on a phone showing how many guests said yes, no and maybe, and how many have not replied",
  },
  {
    title: "A calm front door.",
    text: "Tap a name to check someone in, or add anyone who turns up unannounced. Some phones can scan QR codes too.",
    image: "/brand/screens/check-in.webp",
    alt: "The check-in list on a phone, with guests still to come and a check-in button beside each name",
  },
];

export default function FeatureRows() {
  return (
    <section aria-labelledby="features-title" className="bg-white px-4 py-12 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 id="features-title" className="sr-only">
          What SealSend does
        </h2>
        <div className="space-y-14 sm:space-y-20">
          {features.map((feature, index) => (
            <div key={feature.title} className="grid items-center gap-6 sm:grid-cols-2 sm:gap-12">
              <div className={cn("rounded-3xl bg-[#f2ecff] p-6 sm:p-10", index % 2 === 1 && "sm:order-2")}>
                <Image src={feature.image} alt={feature.alt} width={780} height={1400} sizes="280px" className="mx-auto h-auto w-full max-w-[17rem] rounded-2xl border border-ink/15" />
              </div>
              <div>
                <h3 className="font-display text-3xl text-ink sm:text-4xl">{feature.title}</h3>
                <p className="mt-3 max-w-md text-lg leading-relaxed text-neutral-700">{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-neutral-600">Real SealSend screens with sample guests.</p>
      </div>
    </section>
  );
}
