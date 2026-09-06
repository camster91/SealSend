"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { OnboardingWalkthrough } from "@/components/onboarding/OnboardingWalkthrough";

export function AppProviders({
  children,
  showOnboarding = false,
}: {
  children: React.ReactNode;
  showOnboarding?: boolean;
}) {
  return (
    <ToastProvider>
      {children}
      {showOnboarding && <OnboardingWalkthrough />}
    </ToastProvider>
  );
}
