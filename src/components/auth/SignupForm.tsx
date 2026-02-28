"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthService } from "@/lib/auth/auth-service";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const authService = new AuthService();

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const result = await authService.sendLoginCode({
        method: "email",
        email: email.trim(),
      });

      if (result.success) {
        setStep("code");
      } else {
        setError(result.message);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const result = await authService.verifyCode({
        method: "email",
        email: email.trim(),
        code: code.trim(),
      });

      if (result.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.message);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
            <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="text-sm font-medium text-indigo-700">Check your email</p>
          <p className="mt-1 text-xs text-indigo-600">
            We sent a verification code to <strong>{email}</strong>
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Enter the 6-digit code below:
        </p>

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <Input
            id="otp-code"
            label="Verification Code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
          />

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-accent-red">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Verify Code
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => { setStep("email"); setError(null); setCode(""); }}
            className="text-brand-600 hover:text-brand-700"
          >
            Use a different email
          </button>
          <button
            type="button"
            onClick={() => handleSendCode({ preventDefault: () => {} } as React.FormEvent)}
            disabled={loading}
            className="text-brand-600 hover:text-brand-700"
          >
            Resend code
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4">
      <Input
        id="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-accent-red">
          {error}
        </div>
      )}

      <Button type="submit" loading={loading} className="w-full">
        Get Started
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        No password needed. We&apos;ll email you a secure code to sign in.
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </form>
  );
}
