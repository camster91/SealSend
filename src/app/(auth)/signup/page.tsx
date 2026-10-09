import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";
import { BETA_MODE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Create Account",
};

export default function SignupPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl text-ink">Get started</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Bring your people together. Create an invitation, collect replies, and get ready for a warm welcome.
        </p>
        {BETA_MODE && <p className="mt-3 text-sm font-medium text-ink">Free during the beta: one active event, up to 100 guests. No card needed.</p>}
      </div>
      <Suspense>
        <SignupForm />
      </Suspense>
    </>
  );
}
