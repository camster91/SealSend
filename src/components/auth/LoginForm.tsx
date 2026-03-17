"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { isValidRelativePath } from "@/lib/utils";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/dashboard";
  const redirect = isValidRelativePath(rawRedirect) ? rawRedirect : "/dashboard";

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "email", email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send code");
        return;
      }

      setStep("code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "email",
          email: email.trim(),
          code: otpCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid or expired code");
        return;
      }

      router.push(redirect);
      router.refresh();
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
            We sent a login code to <strong>{email}</strong>
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Enter the 6-digit code from your email:
        </p>

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <Input
            id="otp-code"
            label="Verification Code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter 6-digit code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
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
            onClick={() => { setStep("email"); setError(null); setOtpCode(""); }}
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
        Send Login Code
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        No password needed. We&apos;ll email you a code to sign in.
      </p>
    </form>
  );
}
