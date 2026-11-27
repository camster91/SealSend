import type { Metadata } from "next";
import { TemplatesGallery } from "@/components/marketing/TemplatesGallery";

export const metadata: Metadata = {
  title: "Event Templates & Invitation Styles - SealSend",
  description:
    "Browse 16 designer invitation styles with paired fonts, layouts, and stationery accents. Pick a style and customize every detail before sharing.",
  alternates: { canonical: "/templates" },
};

export default function PublicTemplatesPage() {
  return (
    <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-wax">Invitation styles</p>
          <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">Event templates</h1>
          <p className="mt-3 text-base leading-relaxed text-neutral-600 sm:text-lg">
            Choose a visual starting point. Every colour, font pairing, layout, detail, and question stays editable before you publish.
          </p>
        </div>
        <TemplatesGallery />
      </div>
    </section>
  );
}
