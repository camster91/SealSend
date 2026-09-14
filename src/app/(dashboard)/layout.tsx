import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { AppProviders } from "@/components/providers/AppProviders";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders showOnboarding>
      <div className="flex h-[100dvh] bg-background text-foreground">
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader />
          <main
            id="main-content"
            className="flex-1 overflow-y-auto bg-neutral-50 p-4 pb-24 sm:p-6 md:pb-6 dark:bg-neutral-50"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>

        <MobileTabBar />
      </div>
    </AppProviders>
  );
}
