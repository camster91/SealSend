import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - SealSend",
  description: "Terms of Service for SealSend digital invitation platform.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-neutral-900 mb-8">Terms of Service</h1>
      <p className="text-sm text-neutral-500 mb-8">Last updated: March 22, 2026</p>

      <div className="prose prose-neutral max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>By accessing or using SealSend (&quot;the Service&quot;), operated by Seal and Send (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">2. Description of Service</h2>
          <p>SealSend provides a platform for creating, sending, and managing digital invitations and collecting RSVPs for events. The Service includes both free and paid tiers.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">3. User Accounts</h2>
          <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account and all activity under it. You must be at least 16 years old to use the Service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">4. Payments and Billing</h2>
          <p>Paid features are billed per event or as annual subscriptions through Stripe. All prices are in USD. Per-event purchases are non-refundable once invitations have been sent. We offer a 14-day money-back guarantee on subscription plans.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">5. Acceptable Use</h2>
          <p>You agree not to use the Service to: send spam or unsolicited invitations; distribute illegal, harmful, or offensive content; impersonate others; or violate any applicable laws.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">6. Intellectual Property</h2>
          <p>You retain ownership of content you create. By uploading content, you grant us a limited license to host and display it as part of the Service. SealSend branding, design templates, and code remain our property.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">7. Data and Privacy</h2>
          <p>Your use of the Service is also governed by our <a href="/privacy" className="font-medium text-primary-700 underline underline-offset-2">Privacy Policy</a>. We process guest data only as necessary to provide the Service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">8. Termination</h2>
          <p>We may suspend or terminate your account for violation of these terms. You may delete your account at any time. Upon deletion, we retain your data for 30 days before permanent removal.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">9. Limitation of Liability</h2>
          <p>The Service is provided &quot;as is&quot; without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">10. Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">11. Contact</h2>
          <p>Questions about these terms? Contact us at <a href="mailto:support@sealsend.app" className="font-medium text-primary-700 underline underline-offset-2">support@sealsend.app</a>.</p>
        </section>
      </div>
    </div>
  );
}
