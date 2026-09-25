import type { Metadata } from "next";
import Link from "next/link";
import { BrandSettings } from "@/components/settings/BrandSettings";

export const metadata: Metadata = { title: "Brand kit - SealSend" };

export default function BrandSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <Link href="/settings" className="text-sm text-brand-700 hover:underline">← Settings</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Brand kit</h1>
      </div>
      <BrandSettings />
    </div>
  );
}
