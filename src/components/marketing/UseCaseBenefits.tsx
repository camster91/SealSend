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
    <section className="px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Why Choose Seal and Send
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {benefits.map((b) => {
            const Icon = iconMap[b.icon] ?? Heart;
            return (
              <div
                key={b.title}
                className="rounded-xl border border-border bg-white p-6"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {b.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
