import { Metadata } from "next";
import { Users, Mail, UserPlus } from "lucide-react";

export const metadata: Metadata = {
  title: "Team Settings | SealSend",
  description: "Manage your team members and roles",
};

export default function TeamSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-neutral-900 dark:text-white">
          Team Management
        </h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Invite members to collaborate on your events and share access.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Team Members</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Manage who has access to your workspace</p>
          </div>
          <button className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </button>
        </div>
        
        <div className="p-0">
          <div className="flex items-center justify-between p-6 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-700 dark:text-primary-400 font-semibold">
                ME
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">You (Owner)</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Currently logged in</p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-400">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
