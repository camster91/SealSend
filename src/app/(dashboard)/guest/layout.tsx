import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple header for guests */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">
                <span className="text-gray-900">Seal</span>
                <span className="text-blue-600">Send</span>
              </span>
            </Link>
            <form action={async () => {
              'use server';
              await logout();
              redirect('/');
            }}>
              <Button type="submit" variant="outline" size="sm" className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>
      
      <main>
        {children}
      </main>
    </div>
  );
}
