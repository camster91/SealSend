import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Also check for custom session cookie
  const cookieStore = await cookies();
  const hasCustomSession = !!cookieStore.get("sealsend_session")?.value;
  const isAuthenticated = !!user || hasCustomSession;

  return (
    <>
      <Navbar user={isAuthenticated ? (user || {} as any) : null} />
      <main>{children}</main>
      <Footer />
    </>
  );
}
