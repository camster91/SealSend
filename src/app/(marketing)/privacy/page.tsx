import type { Metadata } from "next";
import { SENDER_LEGAL_NAME, SENDER_POSTAL_ADDRESS, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy - SealSend",
  description: "Plain-language Privacy Policy for SealSend digital invitations.",
  alternates: { canonical: "/privacy" },
};

const linkClass = "font-medium text-ink underline underline-offset-2";
const h2Class = "mb-3 mt-10 text-xl font-semibold text-ink";
const listClass = "list-disc space-y-1 pl-6";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 leading-relaxed text-neutral-700 sm:px-6 sm:py-24">
      <h1 className="mb-4 font-display text-5xl text-ink sm:text-6xl">Privacy Policy</h1>
      <p className="mb-10 text-sm text-neutral-600">Last updated: October 6, 2026</p>

      <div className="prose prose-neutral max-w-none space-y-6">
        <section>
          <p>SealSend is run by Cameron Ashley, operating as {SENDER_LEGAL_NAME}, in Ontario, Canada. This page explains what information we collect, why, and what choices you have. Canadian privacy law (PIPEDA) applies to us.</p>
        </section>

        <section>
          <h2 className={h2Class}>1. What we collect</h2>
          <p><strong>From hosts (people who make events):</strong></p>
          <ul className={listClass}>
            <li>Account details: email, name, sign-in codes and sign-in sessions.</li>
            <li>Event details, images and files you upload, and your branding.</li>
            <li>Client records, if you use them.</li>
            <li>Beta participation and feedback, if you join the beta or send feedback: your consent choice, your rating, the area you picked, what you wrote, whether we may contact you, and simple milestones from your events.</li>
            <li>Your email, if you join a waitlist.</li>
            <li>Simple product-usage events, so we can see what is used and what breaks. We do not use third-party analytics or tracking scripts.</li>
          </ul>
          <p><strong>Guest data that hosts upload or guests give us:</strong></p>
          <ul className={listClass}>
            <li>Names, emails, phone numbers, notes, tags and plus-ones.</li>
            <li>RSVP answers, including dietary and accessibility notes. These can be sensitive, so please only share what you are comfortable with.</li>
            <li>Comments, sign-up board claims and check-in times.</li>
            <li>Optional guest-name sharing, reactions, poll votes, photos and photo captions. Event activities and albums are available only to verified invited guests and authorised hosts. Names appear only if the guest chooses to share them. Photos require host approval unless the host turns that review off. Image metadata is removed when photos are uploaded.</li>
          </ul>
          <p><strong>Technical records:</strong></p>
          <ul className={listClass}>
            <li>Delivery logs of the emails we send, and opt-out (unsubscribe) records.</li>
            <li>IP addresses and email addresses in short-lived rate-limit records, which stop abuse.</li>
            <li>Server error logs.</li>
          </ul>
        </section>

        <section>
          <h2 className={h2Class}>2. How we use it</h2>
          <p>We use your information to run SealSend: sign you in, show your events, send invitations and reminders you ask for, learn from beta feedback and milestones, collect RSVPs, keep the Service secure, fix problems, and answer your questions. We do not sell your information, and we do not use it for advertising.</p>
        </section>

        <section>
          <h2 className={h2Class}>3. Guest data and the host&apos;s role</h2>
          <p>The host decides what guest data to upload and is responsible for having permission to contact those guests. SealSend handles that data on the host&apos;s behalf, only to run the Service.</p>
          <p>Hosts can also set up webhooks and client review links. These send event data to places the host chooses. We do not control those places.</p>
        </section>

        <section>
          <h2 className={h2Class}>4. Who we share it with</h2>
          <p>We use these service providers to run SealSend:</p>
          <ul className={listClass}>
            <li><strong>Mailgun</strong> sends our emails (based in the United States).</li>
            <li><strong>Hostinger</strong> hosts our servers.</li>
            <li><strong>Cloudflare</strong> handles our domain name (DNS).</li>
            <li><strong>OpenAI</strong> is used only when you use AI drafting or chat, and AI cover images (event title, description, chosen style and your note). We send the event details you enter. They are not used to train OpenAI&apos;s models.</li>
            <li><strong>Twilio</strong> would send text messages. SMS is turned off for now.</li>
            <li><strong>Stripe</strong> would handle payments. Payments are turned off for now.</li>
          </ul>
          <p>Your data may be stored or processed outside Canada, including in the United States. Laws there may differ from Canadian law. We may also share information if the law requires it.</p>
        </section>

        <section>
          <h2 className={h2Class}>5. Cookies</h2>
          <p>We use two cookies, both to make the site work. We do not use advertising cookies.</p>
          <ul className={listClass}>
            <li><code>sealsend_session</code> keeps you signed in. It is not readable by scripts on the page (httpOnly) and lasts 7 days. Guests who use their invite or access link also get it.</li>
            <li><code>sealsend_user</code> lets the page show who you are. Scripts on the page can read it. It can include your email, phone, role and event id.</li>
          </ul>
        </section>

        <section>
          <h2 className={h2Class}>6. How long we keep it</h2>
          <p>We keep your data while your account is active. When you ask to delete your account, we treat it as a deletion request: it is scheduled and finished within 7 days. Backups are kept for up to 30 days, so deleted data can stay in backups for up to about 37 days in total.</p>
          <p>We keep opt-out lists so we can keep honouring them.</p>
          <p>Automatic cleanup is currently disabled. If cleanup is later turned on, a draft event becomes eligible 90 days after its last update, with a 14-day warning first, and an unreferenced upload that is not attached to an event becomes eligible after 7 days.</p>
        </section>

        <section>
          <h2 className={h2Class}>7. Your choices and rights</h2>
          <p><strong>Hosts:</strong> you can export your data or delete your account in Settings. You can also email <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>{SUPPORT_EMAIL}</a>.</p>
          <p><strong>Guests:</strong> every guest email has an unsubscribe link that stops that host&apos;s emails. To ask for access, correction or deletion of your information, email <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>{SUPPORT_EMAIL}</a>. We may need to involve the host who invited you.</p>
        </section>

        <section>
          <h2 className={h2Class}>8. Children</h2>
          <p>SealSend is for people 16 and older. We do not knowingly collect information from anyone under 16.</p>
        </section>

        <section>
          <h2 className={h2Class}>9. Security</h2>
          <p>We use HTTPS to protect data in transit, sign-in codes and sessions to protect accounts, and we limit who can reach production data. No system is perfectly secure, so we cannot promise absolute security.</p>
        </section>

        <section>
          <h2 className={h2Class}>10. Contact and complaints</h2>
          <p>Our privacy contact is Cameron Ashley, {SENDER_LEGAL_NAME}, {SENDER_POSTAL_ADDRESS}, <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>{SUPPORT_EMAIL}</a>.</p>
          <p>If we have not solved your concern, you can complain to the <a href="https://www.priv.gc.ca" className={linkClass}>Office of the Privacy Commissioner of Canada</a>.</p>
        </section>

        <section>
          <h2 className={h2Class}>11. Changes</h2>
          <p>We may update this policy. We will change the date at the top and, for important changes, email you or show a notice in the app.</p>
        </section>
      </div>
    </div>
  );
}
