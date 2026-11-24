import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

export const metadata: Metadata = { title: "Invitation link problem", robots: { index: false, follow: false } };

export default function InviteProblemPage() {
  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center bg-cotton px-4 py-12">
      <Logo size="lg" />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-white p-6 text-center sm:p-8">
        <h1 className="font-display text-3xl text-ink">This invitation link isn&apos;t working</h1>
        <p className="mt-3 text-neutral-700">
          It may be incomplete, already used or replaced. Please ask your host to send it again. You don&apos;t need an account to reply.
        </p>
        <p className="mt-6 text-sm text-neutral-600">
          Still stuck? <Link href="/support" className="font-medium text-ink underline underline-offset-4">Get help</Link>
        </p>
      </div>
    </main>
  );
}
