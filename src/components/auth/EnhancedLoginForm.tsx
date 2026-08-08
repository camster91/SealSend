"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthMethod } from "@/lib/auth/types";
import { AuthService } from "@/lib/auth/auth-service";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { isValidRelativePath } from "@/lib/utils";

interface EnhancedLoginFormProps {
  defaultMethod?: AuthMethod;
  eventId?: string; // For guest login
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
  const plan = searchParams.get("plan");
  const rawRedirect = searchParams.get("redirect") || (isGuestMode ? `/events/${eventId}` : "/dashboard");
  const baseRedirect = isValidRelativePath(rawRedirect) ? rawRedirect : "/dashboard";
  const redirect = plan && baseRedirect === "/dashboard" ? `/dashboard?plan=${plan}` : baseRedirect;

  const authService = new AuthService();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      let result;
      
      if (method === 'email' && email) {
        result = await authService.sendLoginCode({
          method: 'email',
          email: email.trim(),
          eventId
        });
      } else if (method === 'phone' && phone) {
        result = await authService.sendLoginCode({
          method: 'phone',
          phone: phone.trim(),
          eventId
        });
      } else if (method === 'password' && email && password) {
        result = await authService.sendLoginCode({
          method: 'password',
          email: email.trim(),
          password: password.trim()
        });
      } else {
        setError('Please fill in all required fields');
        return;
      }

      if (result.success) {
        setSuccess(result.message);
        if (method !== 'password') {
          setStep("code");
        } else {
          // Password login is immediate
          router.push(redirect);
          router.refresh();
        }
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
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
      let result;
      
      if (method === 'email' && email) {
        result = await authService.verifyCode({
          method: 'email',
          email: email.trim(),
          code: code.trim(),
          eventId
        });
      } else if (method === 'phone' && phone) {
        result = await authService.verifyCode({
          method: 'phone',
          phone: phone.trim(),
          code: code.trim(),
          eventId
        });
      }

      if (result?.success) {
        router.push(redirect);
        router.refresh();
      } else {
        setError(result?.message || 'Verification failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderMethodSelector = () => {
    if (isGuestMode) {
      return (
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Guest Access</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose how you want to receive your access code
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              aria-pressed={method === 'email'}
              onClick={() => setMethod('email')}
              className={`p-4 rounded-lg border-2 text-center transition-colors ${
                method === 'email'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <span className="text-sm font-medium">Email</span>
            </button>
            
            <button
              type="button"
              aria-pressed={method === 'phone'}
              onClick={() => setMethod('phone')}
              className={`p-4 rounded-lg border-2 text-center transition-colors ${
                method === 'phone'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              </div>
              <span className="text-sm font-medium">SMS</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Host sign in</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose your preferred login method
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            aria-pressed={method === 'email'}
            onClick={() => setMethod('email')}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              method === 'email'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <span className="text-sm font-medium">Email</span>
          </button>
          
          <button
            type="button"
            aria-pressed={method === 'password'}
            onClick={() => setMethod('password')}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              method === 'password'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Password</span>
          </button>
          
          <button
            type="button"
            aria-pressed={method === 'phone'}
            onClick={() => setMethod('phone')}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              method === 'phone'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <span className="text-sm font-medium">SMS</span>
          </button>
        </div>
      </div>
    );
  };

  const renderInputForm = () => {
    return (
      <form onSubmit={handleSendCode} className="space-y-4">
        {renderMethodSelector()}
        
        <div className="space-y-4">
          {method === 'email' && (
            <Input
              id="email"
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          )}
          
          {method === 'phone' && (
            <Input
              id="phone"
              label="Phone Number"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          )}
          
          {method === 'password' && (
            <>
              <Input
                id="email"
                label="Email Address"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              
              <Input
                id="password"
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-accent-red">
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full">
          {method === 'password' ? 'Sign In' : 'Send Code'}
        </Button>

        {!isGuestMode && (
          <p className="text-center text-xs text-muted-foreground">
            {method === 'password' 
              ? 'Secure password login for administrators'
              : 'We\'ll send you a secure code to sign in'}
          </p>
        )}
      </form>
    );
  };

  const renderCodeForm = () => {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
            {method === 'email' ? (
              <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            )}
          </div>
          <p className="text-sm font-medium text-indigo-700">
            Check your {method === 'email' ? 'email' : 'phone'}
          </p>
          <p className="mt-1 text-xs text-indigo-600">
            We sent a {isGuestMode ? 'guest access' : 'login'} code to{" "}
            <strong>{method === 'email' ? email : phone}</strong>
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
            required
          />

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-accent-red">
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
            onClick={() => { 
              setStep("input"); 
              setError(null); 
              setCode(""); 
              setSuccess(null);
            }}
            className="text-brand-600 hover:text-brand-700"
          >
            Use a different {method === 'email' ? 'email' : 'phone'}
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
  };

  return (
    <div className="space-y-6">
      {step === "input" ? renderInputForm() : renderCodeForm()}
      
      {!isGuestMode && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-center text-sm text-muted-foreground">
            Are you an event guest? Check your invitation link to access your event.
          </p>
        </div>
      )}
    </div>
  );
}
