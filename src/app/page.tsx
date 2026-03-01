import { Navbar } from "@/components/layout/Navbar";
import Hero from "@/components/marketing/Hero";
import FeaturesGrid from "@/components/marketing/FeaturesGrid";
import HowItWorks from "@/components/marketing/HowItWorks";
import CTASection from "@/components/marketing/CTASection";
import Testimonials from "@/components/marketing/Testimonials";
import { Footer } from "@/components/layout/Footer";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  // Get the full user info including role
  const user = await getCurrentUser();

  // Convert to the format expected by Navbar
  const navbarUser = user ? {
    id: user.id,
    email: user.email,
    role: user.role,
    eventId: user.eventId,
  } : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={navbarUser} />
      <main className="flex-1">
        <Hero />
        <FeaturesGrid />
        <HowItWorks />
        <Testimonials />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
