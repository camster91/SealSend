import {
  Heart,
  Users,
  Share2,
  Calendar,
  Baby,
  Gift,
  ClipboardList,
  Mail,
  Cake,
  Music,
  MapPin,
  Briefcase,
  BarChart3,
  Tag,
  Megaphone,
  Palette,
  Plug,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Heart,
  Users,
  Share2,
  Calendar,
  Baby,
  Gift,
  ClipboardList,
  Mail,
  Cake,
  Music,
  MapPin,
  Briefcase,
  BarChart3,
  Tag,
  Megaphone,
  Palette,
  Plug,
};

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

export default function UseCaseBenefits({
  benefits,
}: {
  benefits: Benefit[];
}) {
  return (
    <section className="border-y border-border bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="max-w-2xl font-display text-4xl text-ink sm:text-5xl">What SealSend takes care of</h2>
        <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {benefits.map((b) => {
            const Icon = iconMap[b.icon] ?? Heart;
            return (
              <div key={b.title} className="border-t border-border pt-6">
                <Icon className="h-6 w-6 text-ink" strokeWidth={1.75} aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold text-ink">{b.title}</h3>
                <p className="mt-2 max-w-md leading-relaxed text-neutral-600">{b.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
