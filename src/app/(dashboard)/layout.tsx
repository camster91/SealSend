import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SourceCodeLink } from "@/components/layout/SourceCodeLink";
import { FeedbackProvider } from "@/components/ui/Feedback";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeedbackProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[900] focus:rounded-xl focus:bg-brand-700 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <div className="flex h-[100dvh]">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader />
          <main id="main-content" className="flex-1 overflow-y-auto bg-neutral-50 p-4 pb-20 sm:p-6 md:pb-6">
            {children}
            <p className="mt-10 text-center">
              <SourceCodeLink />
            </p>
          </main>
        </div>

        {/* Mobile bottom tab bar */}
        <MobileTabBar />
      </div>
    </FeedbackProvider>
  );
}
