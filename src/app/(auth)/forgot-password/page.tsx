import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { isEmailConfigured } from "@/lib/email";

export const metadata: Metadata = {
  title: "Forgot Password",
};

// Rendered per request so the advice follows the runtime email configuration.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const emailEnabled = isEmailConfigured();
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl text-ink">Recover your account</h1>
        <p className="mt-3 text-sm text-neutral-600">
          {emailEnabled
            ? "Sign in with an email code, then set a new password in Settings."
            : "We can't email sign-in codes right now, so please contact us for help."}
        </p>
      </div>
      {emailEnabled ? <ForgotPasswordForm /> : (
        <div className="flex flex-col items-center gap-2 text-sm">
          <Link href="/support" className="inline-flex min-h-11 items-center rounded-lg bg-ink px-5 font-medium text-white">Contact support</Link>
          <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-4">Back to sign in</Link>
        </div>
      )}
    </>
  );
}
