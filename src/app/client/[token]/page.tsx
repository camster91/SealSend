import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClientShareView } from "@/lib/clients";
import { getEventBranding } from "@/lib/brands";
import { ClientApproval } from "@/components/client/ClientApproval";
import { sanitizeColor, sanitizeUrl } from "@/lib/sanitize";

export const metadata: Metadata = {
  title: "Event review",
  robots: { index: false, follow: false },
};

function formatWhen(date: string | null, timeZone: string) {
  if (!date) return "Date to be confirmed";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(date));
  } catch {
    return new Date(date).toUTCString();
  }
}

export default async function ClientReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getClientShareView(token);
  if (!view) notFound();
  const branding = await getEventBranding(view.eventId);
  const accent = sanitizeColor(branding?.primaryColor, "#7c3aed");
  const logo = sanitizeUrl(branding?.logoUrl);
  const design = sanitizeUrl(view.designUrl);
  const stats: Array<[string, number]> = [
    ["Invited", view.rsvp.invited],
    ["Attending", view.rsvp.attending],
    ["Maybe", view.rsvp.maybe],
    ["Declined", view.rsvp.declined],
    ["Awaiting reply", view.rsvp.awaiting],
    ["Expected headcount", view.rsvp.headcount],
  ];

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied brand logo */}
          {logo && <img src={logo} alt="" className="h-10 w-auto" />}
          <p className="text-sm font-semibold text-gray-700">{branding?.name ?? "SealSend"}</p>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">{view.clientName ? `Prepared for ${view.clientName}` : "Event review"}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{view.title}</h1>
          <p className="mt-2 text-sm text-gray-700">{formatWhen(view.eventDate, view.eventTimezone)}</p>
          {view.locationName && <p className="text-sm text-gray-700">{view.locationName}</p>}
          {view.hostName && <p className="text-sm text-gray-700">Hosted by {view.hostName}</p>}
          <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">Status: {view.status}</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Invitation</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded invitation design */}
          {design && <img src={design} alt="Invitation design" className="mt-4 w-full rounded-lg border border-gray-100" />}
          {view.invitationHeadline && <p className="mt-4 text-xl font-semibold" style={{ color: accent }}>{view.invitationHeadline}</p>}
          {view.invitationBody && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{view.invitationBody}</p>}
          {!design && !view.invitationHeadline && !view.invitationBody && <p className="mt-2 text-sm text-gray-500">The invitation hasn&apos;t been written yet.</p>}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Responses so far</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 p-3">
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="text-2xl font-bold text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-gray-500">Guest names and contact details stay private to the event team.</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Approve the invitation</h2>
          <ClientApproval token={token} approvedAt={view.approvedAt} approverName={view.approverName} accentColor={accent} />
        </section>

        <p className="text-center text-xs text-gray-400">This review link expires {new Date(view.expiresAt).toLocaleDateString()}.</p>
      </div>
    </main>
  );
}
