import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Recover your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with an email code, then set a new password in Settings
        </p>
      </div>
      <ForgotPasswordForm />
    </>
  );
}
