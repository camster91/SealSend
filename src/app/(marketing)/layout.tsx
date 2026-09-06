import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AppProviders } from "@/components/providers/AppProviders";
import { getCurrentUser } from "@/lib/auth/session";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  const navbarUser = user
    ? {
        id: user.id,
        email: user.email,
        role: user.role,
        eventId: user.eventId,
      }
    : null;

  return (
    <AppProviders>
      <Navbar user={navbarUser} />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </AppProviders>
  );
}
