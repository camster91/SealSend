"use client";

import { useEffect } from "react";

/**
 * Root-level fatal error boundary (replaces root layout when it fails).
 * Must define its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error.digest || error.message);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 font-sans">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="mt-1 text-xs text-gray-400">Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
