import FaqList from "@/components/marketing/FaqList";
import { BETA_MODE } from "@/lib/constants";

const betaFaqs = [
  {
    question: "What is included in the free beta?",
    answer:
      "One active event for up to 100 guests: the invitation, replies, guest list, co-hosts and check-in.",
  },
  {
    question: "What about my second event?",
    answer:
      "You can have one active event at a time. When it's over, archive it and start the next one for free.",
  },
  {
    question: "Will I be charged during the beta?",
    answer:
      "No. Paid checkout is disabled, and SealSend does not ask for a payment card.",
  },
  {
    question: "How do guests get the invitation?",
    answer:
      "You share your event link. SealSend doesn't send text messages or emails to guests for you yet.",
  },
  {
    question: "Do guests need an account or app?",
    answer:
      "No. They open the link and reply.",
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
