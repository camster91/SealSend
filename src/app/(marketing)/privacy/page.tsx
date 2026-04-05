import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - SealSend",
  description: "Privacy Policy for SealSend digital invitation platform.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-neutral-900 mb-8">Privacy Policy</h1>
      <p className="text-sm text-neutral-500 mb-8">Last updated: March 22, 2026</p>

      <div className="prose prose-neutral max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
          <p><strong>Account Information:</strong> Email address, name (optional), and authentication data when you create an account.</p>
          <p><strong>Event Data:</strong> Event details, guest lists, RSVP responses, and messages you create through the Service.</p>
          <p><strong>Usage Data:</strong> Browser type, device information, IP address, pages visited, and feature usage to improve the Service.</p>
          <p><strong>Payment Data:</strong> Processed securely by Stripe. We do not store credit card numbers.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">2. How We Use Your Information</h2>
          <p>We use your data to: provide and improve the Service; send invitations and notifications on your behalf; process payments; communicate service updates; and prevent fraud.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">3. Guest Data</h2>
          <p>When you add guests to an event, we process their email addresses and phone numbers solely to deliver invitations and collect RSVPs. Guest data is not used for marketing or shared with third parties.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">4. Data Sharing</h2>
          <p>We do not sell your data. We share data only with: Stripe (payments), Mailgun/Resend (email delivery), Twilio (SMS delivery), and as required by law.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">5. Data Security</h2>
          <p>We use encryption in transit (TLS) and at rest. Access to production data is restricted. We perform regular security reviews.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">6. Data Retention</h2>
          <p>Active account data is retained while your account exists. Deleted events are removed within 30 days. Deleted accounts and all associated data are permanently removed within 30 days.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">7. Your Rights</h2>
          <p>You can: access and export your data; correct inaccurate information; delete your account and data; and opt out of non-essential communications. To exercise these rights, email <a href="mailto:support@sealsend.app" className="text-primary-600 hover:underline">support@sealsend.app</a>.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">8. Cookies</h2>
          <p>We use essential cookies for authentication and session management. We do not use third-party advertising cookies.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">9. Children</h2>
          <p>The Service is not intended for children under 16. We do not knowingly collect data from children.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">10. Changes</h2>
          <p>We may update this policy. We will notify you of material changes via email or in-app notice.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">11. Contact</h2>
          <p>Privacy questions? Contact us at <a href="mailto:support@sealsend.app" className="text-primary-600 hover:underline">support@sealsend.app</a>.</p>
        </section>
      </div>
    </div>
  );
}
