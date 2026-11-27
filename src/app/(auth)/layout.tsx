import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { SourceCodeLink } from "@/components/layout/SourceCodeLink";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cotton">
      <header className="border-b border-border/70 bg-cotton/95">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cotton" />
          <nav aria-label="Account navigation" className="flex items-center gap-4 text-sm font-medium text-neutral-700">
            <Link href="/templates" className="inline-flex min-h-11 items-center hover:text-ink">
              Templates
            </Link>
            <Link href="/pricing" className="inline-flex min-h-11 items-center hover:text-ink">
              Pricing
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
        <p className="mt-6">
          <SourceCodeLink />
        </p>
      </main>
    </div>
  );
}
