import { Metadata } from "next";
import { Sparkles, Wand2 } from "lucide-react";

export const metadata: Metadata = {
  title: "AI Design Assistant | SealSend",
  description: "Generate invitations with AI",
};

export default function AIAssistantPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="text-center space-y-4 py-12">
        <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-3xl font-display font-bold text-neutral-900 dark:text-white">
          AI Design Assistant
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto">
          Describe your event, and our AI will instantly generate a beautiful, personalized invitation template with matching copy.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          What kind of event are you hosting?
        </label>
        <textarea
          className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-4 py-3 text-sm focus:border-primary-500 focus:ring-primary-500 dark:text-white min-h-[120px]"
          placeholder="e.g. A whimsical forest-themed baby shower for Sarah on October 15th..."
        />
        <div className="mt-4 flex justify-end">
          <button className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:from-primary-700 hover:to-indigo-700 transition-all shadow-md">
            <Wand2 className="mr-2 h-4 w-4" />
            Generate Design
          </button>
        </div>
      </div>
    </div>
  );
}
