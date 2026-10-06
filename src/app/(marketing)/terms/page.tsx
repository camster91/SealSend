import type { Metadata } from "next";
import { SENDER_LEGAL_NAME, SENDER_POSTAL_ADDRESS, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service - SealSend",
  description: "Plain-language Terms of Service for SealSend digital invitations.",
  alternates: { canonical: "/terms" },
};

const linkClass = "font-medium text-ink underline underline-offset-2";
const h2Class = "mb-3 mt-10 text-xl font-semibold text-ink";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 leading-relaxed text-neutral-700 sm:px-6 sm:py-24">
      <h1 className="mb-4 font-display text-5xl text-ink sm:text-6xl">Terms of Service</h1>
      <p className="mb-10 text-sm text-neutral-600">Last updated: October 6, 2026</p>

      <div className="prose prose-neutral max-w-none space-y-6">
        <section>
          <h2 className={h2Class}>1. Who we are</h2>
          <p>SealSend is run by Cameron Ashley, operating as {SENDER_LEGAL_NAME}, in Ontario, Canada. In these terms, &quot;we&quot; and &quot;us&quot; mean {SENDER_LEGAL_NAME}. Our mailing address is {SENDER_POSTAL_ADDRESS}. You can reach us at <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>{SUPPORT_EMAIL}</a>.</p>
          <p>By using SealSend (&quot;the Service&quot;), you agree to these terms. If you do not agree, please do not use it.</p>
        </section>

        <section>
          <h2 className={h2Class}>2. What the Service is</h2>
          <p>SealSend lets you create digital invitations, send them to guests by email, and collect RSVPs. It is a free beta. That means:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>It is offered &quot;as is&quot;, with no promise that it will always work or be available.</li>
            <li>Features, limits and the way it works may change or be removed.</li>
            <li>Every account is on the beta plan: one active event and up to 100 guests.</li>
            <li>Email works today. Text messages (SMS) are turned off for now.</li>
          </ul>
        </section>

        <section>
          <h2 className={h2Class}>3. Your account</h2>
          <p>You must be at least 16 years old. Give us accurate information and keep your sign-in secure. You are responsible for what happens under your account.</p>
        </section>

        <section>
          <h2 className={h2Class}>4. Paid plans</h2>
          <p>Paid plans are not available yet, and we do not charge anyone. If we add paid plans, we will show you the price and the terms before you are charged.</p>
        </section>

        <section>
          <h2 className={h2Class}>5. Open source and our brand</h2>
          <p>SealSend&apos;s code is open source under the GNU AGPL-3.0 licence. The licence text and source code are linked in the site footer, and the licence is what governs your use of the code. The AGPL does not give you any right to use the SealSend name or logo. You keep ownership of the content you put into the Service, and you let us store and show it as needed to run the Service for you.</p>
        </section>

        <section>
          <h2 className={h2Class}>6. Rules for using SealSend</h2>
          <p>You agree that you will:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Only email people you have permission to email, or people you already have a relationship with, as anti-spam laws (including Canada&apos;s CASL) require.</li>
            <li>Not send spam or unwanted messages.</li>
            <li>Follow all anti-spam and privacy laws that apply to you.</li>
            <li>Respect unsubscribes. If a guest unsubscribes, do not try to email them again through SealSend.</li>
            <li>Stay within the sending limit of 300 guest emails per account in any rolling 24 hours.</li>
            <li>Not use the Service for anything illegal, harmful, hateful or misleading, and not pretend to be someone else.</li>
          </ul>
        </section>

        <section>
          <h2 className={h2Class}>7. Guest data you upload</h2>
          <p>You decide what guest information to upload, and you are responsible for having the right to do so and to contact those guests. We handle guest data for you, to run the Service. See our <a href="/privacy" className={linkClass}>Privacy Policy</a> for details.</p>
          <p>You agree to cover (indemnify) us for claims, losses and costs that come from your misuse of the Service or from guest data you uploaded or contacted without permission.</p>
        </section>

        <section>
          <h2 className={h2Class}>8. Suspending or ending accounts</h2>
          <p>We can suspend or close an account that breaks these rules or puts the Service or other people at risk. You can ask us to delete your account at any time from Settings, or by emailing <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>{SUPPORT_EMAIL}</a>. We complete a deletion request within 7 days, as explained in the Privacy Policy. We may keep limited records where the law or security requires it, such as opt-out lists so we keep honouring them.</p>
        </section>

        <section>
          <h2 className={h2Class}>9. Limits on our responsibility</h2>
          <p>To the fullest extent the law allows, we are not responsible for indirect or consequential losses, such as lost events, lost guests or lost profits. While the Service is free, our total liability to you for anything related to the Service is limited to CAD $100. Nothing in these terms limits rights you have under law that cannot be limited.</p>
        </section>

        <section>
          <h2 className={h2Class}>10. Governing law</h2>
          <p>These terms are governed by the laws of Ontario and the federal laws of Canada that apply there. Any dispute will be handled in the courts of Toronto, Ontario.</p>
        </section>

        <section>
          <h2 className={h2Class}>11. Changes to these terms</h2>
          <p>We may update these terms. We will change the date at the top. For important changes, we will also email you. If you keep using the Service after a change, you accept the new terms.</p>
        </section>

        <section>
          <h2 className={h2Class}>12. Contact</h2>
          <p>Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>{SUPPORT_EMAIL}</a> or write to {SENDER_LEGAL_NAME}, {SENDER_POSTAL_ADDRESS}.</p>
        </section>
      </div>
    </div>
  );
}
