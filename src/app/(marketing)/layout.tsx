import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getCurrentUser } from "@/lib/auth/session";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the full user info including role
  const user = await getCurrentUser();

  // Convert to the format expected by Navbar
  const navbarUser = user
    ? {
        id: user.id,
        email: user.email,
        role: user.role,
        eventId: user.eventId,
      }
    : null;

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[900] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <Navbar user={navbarUser} />
      <main id="main-content">{children}</main>
      <Footer />
    </>
  );
}
