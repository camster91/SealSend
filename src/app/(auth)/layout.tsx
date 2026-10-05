import { Logo } from "@/components/layout/Logo";
import { SourceCodeLink } from "@/components/layout/SourceCodeLink";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center bg-cotton px-4 py-12">
      <div className="mb-8">
        <Logo size="lg" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cotton" />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 sm:p-8">
        {children}
      </div>
      <p className="mt-6">
        <SourceCodeLink />
      </p>
    </main>
  );
}
