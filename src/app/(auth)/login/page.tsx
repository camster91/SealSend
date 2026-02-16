import type { Metadata } from "next";
import { Suspense } from "react";
import { EnhancedLoginForm } from "@/components/auth/EnhancedLoginForm";

export const metadata: Metadata = {
  title: "Admin Login - Seal and Send",
};

export default function LoginPage() {
  return (
    <>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Sign in to manage your events and guests
        </p>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse bg-gray-200 rounded-lg" />}>
        <EnhancedLoginForm defaultMethod="email" />
      </Suspense>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            New to Seal and Send?{" "}
            <a 
              href="/signup" 
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Create an account
            </a>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Secure authentication with email, SMS, or password options
          </p>
        </div>
      </div>
    </>
  );
}
