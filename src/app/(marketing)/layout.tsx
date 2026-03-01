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
      <Navbar user={navbarUser} />
      <main>{children}</main>
      <Footer />
    </>
  );
}
