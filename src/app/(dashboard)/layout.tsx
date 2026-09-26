import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SourceCodeLink } from "@/components/layout/SourceCodeLink";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
  );
}
