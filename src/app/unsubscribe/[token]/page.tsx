import type { Metadata } from "next";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { getUnsubscribeHostName, hasEmailSuppression, HOST_NAME_FALLBACK } from "@/lib/guest-email";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { UnsubscribeForm } from "@/components/unsubscribe/UnsubscribeForm";

export const metadata: Metadata = {
  title: "Stop emails",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = verifyUnsubscribeToken(token);
  const [hostName, alreadyUnsubscribed] = target
    ? await Promise.all([getUnsubscribeHostName(target), hasEmailSuppression(target.ownerUserId, target.email)])
    : [null, false];

  return (
    <main className="min-h-screen bg-cotton px-4 py-12 text-ink">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-hairline bg-white p-6 sm:p-8">
        {target ? (
          <UnsubscribeForm
            token={token}
            hostName={hostName === HOST_NAME_FALLBACK ? "your host" : hostName ?? "your host"}
            email={target.email}
            alreadyUnsubscribed={alreadyUnsubscribed}
          />
        ) : (
          <>
            <h1 className="break-words text-2xl font-semibold">This link isn&apos;t valid.</h1>
            <p className="mt-3 text-base text-muted-foreground">
              It may have been cut off when it was copied. Try the link in the email again, or write to{" "}
              <a className="break-all underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
