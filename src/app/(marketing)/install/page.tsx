import type { Metadata } from 'next';
import Link from 'next/link';
import { InstallButton } from '@/components/mobile/InstallButton';
export const metadata: Metadata = { title:'Add SealSend to your phone',description:'Add SealSend to your home screen on iPhone, iPad or Android.',alternates:{ canonical:'https://sealsend.app/install' } };
export default function InstallPage() {
  return <div className="mx-auto max-w-3xl px-4 py-12 text-ink sm:px-6">
    <h1 className="font-display text-4xl">SealSend on your phone</h1>
    <p className="mt-4 text-lg">Add SealSend to your home screen for quick access to your events. You can keep using the same account.</p>
    <div className="mt-6"><InstallButton /></div>
    <section className="mt-8 rounded-xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">iPhone and iPad</h2><ol className="mt-3 list-decimal space-y-2 pl-5"><li>Open sealsend.app in Safari.</li><li>Open the Share menu.</li><li>Choose Add to Home Screen, then Add.</li></ol></section>
    <section className="mt-6 rounded-xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">Android</h2><ol className="mt-3 list-decimal space-y-2 pl-5"><li>Open sealsend.app in Chrome.</li><li>Use Install SealSend above if it appears, or open the browser menu.</li><li>Choose Install app or Add to Home screen.</li></ol></section>
    <p className="mt-6 text-sm text-muted-foreground">An internet connection is needed to view or change event details. If you lose your connection, SealSend shows a reconnect page.</p>
    <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-ink px-5 py-3 font-medium text-white">Open my events</Link>
  </div>;
}
