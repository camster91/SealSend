"use client";

import Link from "next/link";

export function ForgotPasswordForm() {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">
        Choose Email on the sign-in page. We&apos;ll send a one-time code so you
        can regain access without knowing your password.
      </p>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        Go to Sign In
      </Link>
    </div>
  );
}
