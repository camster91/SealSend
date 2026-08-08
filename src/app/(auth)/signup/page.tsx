import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create Account",
};

export default function SignupPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Get started</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an account, then turn your event idea into an editable invitation, RSVP flow, and guest communication plan.
        </p>
      </div>
      <Suspense>
        <SignupForm />
      </Suspense>
    </>
  );
}
