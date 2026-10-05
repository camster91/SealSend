import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { EnhancedLoginForm } from "@/components/auth/EnhancedLoginForm";

export const metadata: Metadata = {
  title: "Host Sign In - SealSend",
};

export default function LoginPage() {
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl text-ink">Welcome back</h1>
        <p className="mt-3 text-neutral-600">
          Sign in to manage your events and guests.
        </p>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-neutral-100" />}>
        <EnhancedLoginForm defaultMethod="email" />
      </Suspense>

      <div className="mt-8 border-t border-border pt-6">
        <div className="text-center">
          <p className="text-sm text-neutral-600">
            New to SealSend?{" "}
            <Link
              href="/signup"
              className="font-medium text-ink underline underline-offset-4 decoration-ink/30 hover:decoration-ink"
            >
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-xs text-neutral-600">
            Sign in with an email code, a text message code or a password.
          </p>
        </div>
      </div>
    </>
  );
}
