import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold">
            <span className="text-foreground">Seal</span>
            <span className="text-brand-600">Send</span>
          </span>
        </Link>
      </div>
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
