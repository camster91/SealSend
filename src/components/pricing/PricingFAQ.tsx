import FaqList from "@/components/marketing/FaqList";
import { BETA_MODE } from "@/lib/constants";

const betaFaqs = [
  {
    question: "What is included in the controlled beta?",
    answer:
      "A controlled beta account can run one active event for up to 100 guests, including the shipped invitation, RSVP, guest-management, communications, co-host, analytics, and check-in tools.",
  },
  {
    question: "Will I be charged during the beta?",
    answer:
      "No. Paid checkout is disabled during the controlled beta, and SealSend does not ask for a payment card.",
  },
  {
    question: "Are guest communications sent automatically?",
    answer:
      "No. The host reviews and deliberately starts every email to guests. Provider delivery is verified with each approved beta host before live use.",
  },
  {
    question: "Do guests need an account or app?",
    answer:
      "No. Guests use the published event link in a browser to review details and submit their RSVP.",
  },
];

const paidFaqs = [
  {
    question: "What is the difference between an event upgrade and annual Pro?",
    answer:
      "An Event Pass is a one-time upgrade for a single event: up to 250 guests, 500 SMS segments (add 200 more for $5 if you need them), every event feature, and no SealSend badge. Annual Pro covers unlimited events for one year, with up to 2,500 guests per event.",
  },
  {
    question: "What happens when I hit my event or guest limit?",
    answer:
      "SealSend stops new guests or responses at the event's limit. You can upgrade that event, or use annual Pro for the highest capacity.",
  },
  {
    question: "Does canceling Pro change event upgrades I already purchased?",
    answer:
      "No. An event with its own Event Pass (or an earlier one-time upgrade) keeps its capacity after annual Pro ends.",
  },
  {
    question: "How many events can I create for free?",
    answer:
      "A free account can create one event for up to 50 guests, with email invitations. Annual Pro allows unlimited events during the active subscription.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "Checkout is securely processed by Stripe. The payment methods shown at checkout depend on the methods enabled for SealSend's Stripe account.",
  },
];

export const PRICING_FAQS = BETA_MODE ? betaFaqs : paidFaqs;

export function PricingFAQ() {
  return (
    <FaqList faqs={PRICING_FAQS} title={BETA_MODE ? "About the beta" : "Pricing questions"}>
      Still have a question?{" "}
      <a href="mailto:support@sealsend.app" className="font-semibold text-ink underline underline-offset-4">
        Email support@sealsend.app
      </a>
    </FaqList>
  );
}
