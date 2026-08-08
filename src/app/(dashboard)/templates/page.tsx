import Link from "next/link";
import { EVENT_TEMPLATES } from "@/lib/event-templates";

export default function TemplatesPage() {
  return <div className="mx-auto max-w-6xl py-6">
    <div className="mb-8"><h1 className="text-3xl font-bold text-gray-900">Event templates</h1><p className="mt-2 text-gray-600">Choose a visual starting point. Every colour, font, detail, and question remains editable before publishing.</p></div>
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{EVENT_TEMPLATES.map((template) => <article key={template.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex h-40 items-center justify-center p-6" style={{ backgroundColor: template.customization.backgroundColor }}><div className="w-full rounded-xl border bg-white/80 p-5 text-center shadow-sm"><p className="text-xs font-semibold uppercase tracking-widest" style={{ color: template.customization.primaryColor }}>{template.category}</p><p className="mt-2 text-xl font-bold" style={{ fontFamily: template.customization.fontFamily }}>{template.name}</p><span className="mt-4 inline-block px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: template.customization.primaryColor, borderRadius: template.customization.buttonStyle === 'pill' ? 999 : template.customization.buttonStyle === 'square' ? 0 : 8 }}>RSVP</span></div></div>
      <div className="p-5"><h2 className="font-bold">{template.name}</h2><p className="mt-1 text-sm text-gray-600">{template.description}</p><Link href={`/events/new?template=${template.id}`} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">Use this template</Link></div>
    </article>)}</div>
  </div>;
}
