"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthMethod } from "@/lib/auth/types";
import { loginWithPassword, verifyOtp, sendOtp } from "@/actions/authActions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { isValidRelativePath } from "@/lib/utils";

interface EnhancedLoginFormProps {
  defaultMethod?: AuthMethod;
  eventId?: string; 
  isGuestMode?: boolean;
}

export function EnhancedLoginForm({ 
  defaultMethod = 'email', 
  eventId,
  isGuestMode = false 
}: EnhancedLoginFormProps) {
  const [method, setMethod] = useState<AuthMethod>(defaultMethod);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"input" | "code">("input");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || (isGuestMode ? `/events/${eventId}` : "/dashboard");
  const redirect = isValidRelativePath(rawRedirect) ? rawRedirect : "/dashboard";

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (method === 'email' && email) {
        await sendOtp(email.trim());
        setSuccess('Verification code sent to your email');
        setStep("code");
      } else if (method === 'password' && email && password) {
        await loginWithPassword(email.trim(), password.trim());
        router.push(redirect);
        router.refresh();
      } else {
        setError('Please fill in all required fields');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await verifyOtp(email || phone || "", code.trim());
      router.push(redirect);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={step === "input" ? handleSendCode : handleVerifyCode} className="space-y-6">
      {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>}
      {success && <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg">{success}</div>}
      
      {step === "input" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['email', 'phone', 'password'] as AuthMethod[]).map(m => (
              <Button key={m} type="button" variant={method === m ? 'default' : 'outline'} onClick={() => setMethod(m)}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Button>
            ))}
          </div>
          {method === 'email' && <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
          {method === 'phone' && <Input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />}
          {method === 'password' && (
            <>
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Processing...' : method === 'password' ? 'Sign In' : 'Send Code'}
          </Button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-4">
          <Input type="text" placeholder="Verification Code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </div>
      )}
    </form>
  );
}
