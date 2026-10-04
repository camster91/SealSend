import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { SourceCodeLink } from "@/components/layout/SourceCodeLink";

const columns = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "Log in", href: "/login" },
      { label: "Get started", href: "/signup" },
    ],
  },
  {
    title: "Use cases",
    links: [
      { label: "Event planners", href: "/use-cases/event-planners" },
      { label: "Weddings", href: "/use-cases/weddings" },
      { label: "Birthday parties", href: "/use-cases/birthday-parties" },
      { label: "Community events", href: "/use-cases/community-events" },
      { label: "Clubs and associations", href: "/use-cases/clubs-associations" },
      { label: "Local nonprofits", href: "/use-cases/nonprofit-events" },
      { label: "Professional gatherings", href: "/use-cases/professional-gatherings" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Support", href: "/support" },
      { label: "support@sealsend.app", href: "mailto:support@sealsend.app" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
];

const linkClass = "inline-flex min-h-9 items-center text-[0.95rem] text-neutral-600 transition-colors hover:text-ink";

export function Footer() {
  return (
    <footer className="border-t border-border bg-cotton">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-8 sm:gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo />
            <p className="mt-4 max-w-xs leading-relaxed text-neutral-600">
              Send the invitation, know who&apos;s coming, and check guests in at the door, all from one link.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-sm font-semibold text-ink">{column.title}</h2>
                <ul className="mt-3 space-y-1">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      {link.href.startsWith("mailto:") ? (
                        <a href={link.href} className={linkClass}>
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className={linkClass}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                  {column.title === "Company" && (
                    <li>
                      <SourceCodeLink className={linkClass} />
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 sm:mt-12 sm:pt-8">
          <p className="text-sm text-neutral-600">
            &copy; {new Date().getFullYear()} SealSend. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
