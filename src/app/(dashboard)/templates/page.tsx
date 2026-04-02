import { Metadata } from "next";
import { Plus, LayoutTemplate, Star, Clock } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Templates | SealSend",
  description: "Browse and manage your invitation templates",
};

const TEMPLATES = [
  {
    id: "t1",
    name: "Modern Wedding",
    category: "Wedding",
    isPremium: true,
    thumbnail: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=500&h=300&fit=crop",
  },
  {
    id: "t2",
    name: "Corporate Gala",
    category: "Corporate",
    isPremium: false,
    thumbnail: "https://images.unsplash.com/photo-1511578314322-379aeb463616?w=500&h=300&fit=crop",
  },
  {
    id: "t3",
    name: "Birthday Bash",
    category: "Party",
    isPremium: false,
    thumbnail: "https://images.unsplash.com/photo-1530103862676-de889dd08728?w=500&h=300&fit=crop",
  },
  {
    id: "t4",
    name: "Baby Shower",
    category: "Shower",
    isPremium: true,
    thumbnail: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=500&h=300&fit=crop",
  }
];

export default function TemplatesPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-900 dark:text-white">
            Template Gallery
          </h1>
          <p className="mt-1 text-neutral-500 dark:text-neutral-400">
            Start your next event with a professionally designed template.
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create from Scratch
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {TEMPLATES.map((template) => (
          <div key={template.id} className="group relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden hover:border-primary-500/50 transition-all hover:shadow-md">
            <div className="aspect-[4/3] relative bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={template.thumbnail} 
                alt={template.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {template.isPremium && (
                <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-400 to-amber-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center shadow-sm">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  Premium
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                  {template.category}
                </span>
              </div>
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">
                {template.name}
              </h3>
              <Link
                href={`/events/new?template=${template.id}`}
                className="block w-full py-2 text-center rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                Use Template
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
