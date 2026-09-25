import type { Metadata } from "next";
import Link from "next/link";
import { ClientsSettings } from "@/components/settings/ClientsSettings";

export const metadata: Metadata = { title: "Clients - SealSend" };

export default function ClientsSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <Link href="/settings" className="text-sm text-brand-700 hover:underline">← Settings</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Clients</h1>
      </div>
      <ClientsSettings />
    </div>
  );
}
